use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Url};
use tauri_plugin_opener::OpenerExt;
use tiny_http::{Header, Method, Response, Server};

const SCOPE: &str = "https://www.googleapis.com/auth/drive.appdata";
const CLIENT_ID: Option<&str> = option_env!("BETE_GOOGLE_DESKTOP_CLIENT_ID");
const CLIENT_SECRET: Option<&str> = option_env!("BETE_GOOGLE_DESKTOP_CLIENT_SECRET");
const NETWORK_ERROR: &str = "Connexion à Google indisponible. Réessaie.";
const VAULT_ERROR: &str = "Le gestionnaire d’identifiants Windows est indisponible.";
static BUSY: AtomicBool = AtomicBool::new(false);

struct AuthOperation;
impl AuthOperation {
    fn start() -> Result<Self, String> {
        BUSY.compare_exchange(false, true, Ordering::Acquire, Ordering::Relaxed)
            .map(|_| Self)
            .map_err(|_| "Une opération Google Drive est déjà en cours.".into())
    }
}
impl Drop for AuthOperation {
    fn drop(&mut self) {
        BUSY.store(false, Ordering::Release);
    }
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: u64,
    refresh_token: Option<String>,
    scope: Option<String>,
}

#[derive(Serialize)]
pub struct AccessToken {
    access_token: String,
    expires_in: u64,
}

impl From<TokenResponse> for AccessToken {
    fn from(token: TokenResponse) -> Self {
        Self {
            access_token: token.access_token,
            expires_in: token.expires_in,
        }
    }
}

#[tauri::command]
pub fn drive_configured() -> bool {
    cfg!(windows)
        && CLIENT_ID.is_some_and(|s| !s.trim().is_empty())
        && CLIENT_SECRET.is_some_and(|s| !s.trim().is_empty())
}

fn credentials() -> Result<keyring::Entry, String> {
    if !drive_configured() {
        return Err("Google Drive n’est pas configuré pour cette compilation.".into());
    }
    keyring::Entry::new("eu.usini.bete2.google-drive", CLIENT_ID.unwrap())
        .map_err(|_| VAULT_ERROR.into())
}

fn random_value() -> Result<String, String> {
    let mut bytes = [0; 32];
    getrandom::fill(&mut bytes).map_err(|_| "Impossible de sécuriser la connexion Google.")?;
    Ok(URL_SAFE_NO_PAD.encode(bytes))
}

fn http() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| NETWORK_ERROR.into())
}

async fn exchange(mut fields: Vec<(&str, &str)>) -> Result<Option<TokenResponse>, String> {
    fields.push(("client_id", CLIENT_ID.unwrap()));
    fields.push(("client_secret", CLIENT_SECRET.unwrap()));
    let response = http()?
        .post("https://oauth2.googleapis.com/token")
        .form(&fields)
        .send()
        .await
        .map_err(|_| NETWORK_ERROR)?;
    if !response.status().is_success() {
        #[derive(Deserialize)]
        struct OAuthError {
            error: String,
        }
        if response
            .json::<OAuthError>()
            .await
            .is_ok_and(|e| e.error == "invalid_grant")
        {
            return Ok(None);
        }
        return Err(
            "Google a refusé la demande OAuth. Vérifie la configuration du client Desktop.".into(),
        );
    }
    let token: TokenResponse = response.json().await.map_err(|_| NETWORK_ERROR)?;
    if token.access_token.is_empty()
        || token.expires_in <= 60
        || token
            .scope
            .as_ref()
            .is_some_and(|scopes| !scopes.split_whitespace().any(|s| s == SCOPE))
    {
        return Err("Google n’a pas fourni l’autorisation Drive attendue.".into());
    }
    Ok(Some(token))
}

fn wait_for_code(server: Server, redirect: String, state: String) -> Result<String, String> {
    let deadline = Instant::now() + Duration::from_secs(180);
    while let Some(request) = server
        .recv_timeout(deadline.saturating_duration_since(Instant::now()))
        .map_err(|_| "Le retour local de Google a échoué.")?
    {
        let callback = request
            .url()
            .strip_prefix("/oauth/callback?")
            .and_then(|query| Url::parse(&format!("{redirect}?{query}")).ok());
        if request.method() == &Method::Get {
            if let Some(callback) = callback {
                let mut params = callback.query_pairs();
                let valid_state = params.any(|(key, value)| key == "state" && value == state);
                if valid_state {
                    let code = callback
                        .query_pairs()
                        .find(|(key, value)| key == "code" && !value.is_empty())
                        .map(|(_, value)| value.into_owned());
                    let _ = request.respond(
                        Response::from_string("Tu peux fermer cet onglet et revenir dans Bête.")
                            .with_header(Header::from_bytes("Cache-Control", "no-store").unwrap())
                            .with_header(
                                Header::from_bytes("Referrer-Policy", "no-referrer").unwrap(),
                            )
                            .with_header(
                                Header::from_bytes("Content-Type", "text/plain; charset=utf-8")
                                    .unwrap(),
                            ),
                    );
                    return code.ok_or_else(|| "Connexion Google annulée ou refusée.".into());
                }
            }
        }
        let _ = request.respond(Response::empty(404));
        if Instant::now() >= deadline {
            break;
        }
    }
    Err("Connexion Google expirée. Réessaie depuis Bête.".into())
}

#[tauri::command]
pub async fn drive_login(app: AppHandle) -> Result<AccessToken, String> {
    let _operation = AuthOperation::start()?;
    let entry = credentials()?;
    let server =
        Server::http("127.0.0.1:0").map_err(|_| "Impossible d’ouvrir le retour local Google.")?;
    let redirect = format!("http://{}/oauth/callback", server.server_addr());
    let state = random_value()?;
    let verifier = random_value()?;
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let mut url = Url::parse("https://accounts.google.com/o/oauth2/v2/auth").unwrap();
    url.query_pairs_mut().extend_pairs([
        ("client_id", CLIENT_ID.unwrap()),
        ("redirect_uri", &redirect),
        ("response_type", "code"),
        ("scope", SCOPE),
        ("access_type", "offline"),
        ("prompt", "consent select_account"),
        ("state", &state),
        ("code_challenge", &challenge),
        ("code_challenge_method", "S256"),
    ]);
    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|_| "Impossible d’ouvrir le navigateur.")?;
    let callback = redirect.clone();
    let code = tauri::async_runtime::spawn_blocking(move || wait_for_code(server, callback, state))
        .await
        .map_err(|_| "Le retour local de Google a échoué.")??;
    let token = exchange(vec![
        ("grant_type", "authorization_code"),
        ("code", &code),
        ("redirect_uri", &redirect),
        ("code_verifier", &verifier),
    ])
    .await?
    .ok_or("Le code Google a expiré. Reconnecte-toi.")?;
    let refresh = token
        .refresh_token
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or("Google n’a pas fourni de jeton de renouvellement.")?;
    entry.set_password(refresh).map_err(|_| VAULT_ERROR)?;
    Ok(token.into())
}

#[tauri::command]
pub async fn drive_token() -> Result<Option<AccessToken>, String> {
    let _operation = AuthOperation::start()?;
    let entry = credentials()?;
    let refresh = match entry.get_password() {
        Ok(refresh) => refresh,
        Err(keyring::Error::NoEntry) => return Ok(None),
        Err(_) => return Err(VAULT_ERROR.into()),
    };
    let token = exchange(vec![
        ("grant_type", "refresh_token"),
        ("refresh_token", &refresh),
    ])
    .await?;
    if let Some(next) = token
        .as_ref()
        .and_then(|token| token.refresh_token.as_deref())
    {
        entry.set_password(next).map_err(|_| VAULT_ERROR)?;
    }
    Ok(token.map(Into::into))
}

#[tauri::command]
pub async fn drive_logout() -> Result<(), String> {
    let _operation = AuthOperation::start()?;
    let entry = credentials()?;
    // Google revokes the grant for every client in the project. Disconnect this device only.
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err(VAULT_ERROR.into()),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpStream;

    #[test]
    fn loopback_rejects_a_wrong_state_before_accepting_the_callback() {
        let server = Server::http("127.0.0.1:0").unwrap();
        let addr = server.server_addr().to_ip().unwrap();
        let redirect = format!("http://{addr}/oauth/callback");
        let listener =
            std::thread::spawn(move || wait_for_code(server, redirect, "expected".into()));
        let request = |query| {
            let mut socket = TcpStream::connect(addr).unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(3)))
                .unwrap();
            write!(
                socket,
                "GET /oauth/callback?{query} HTTP/1.1\r\nHost: {addr}\r\nConnection: close\r\n\r\n"
            )
            .unwrap();
            let mut response = String::new();
            socket.read_to_string(&mut response).unwrap();
            response
        };
        assert!(request("state=wrong&code=ignored").starts_with("HTTP/1.1 404"));
        let response = request("state=expected&code=accepted");
        assert!(response.starts_with("HTTP/1.1 200"));
        assert!(!response.contains("code=accepted"));
        assert_eq!(listener.join().unwrap().unwrap(), "accepted");
    }
}
