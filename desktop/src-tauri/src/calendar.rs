use std::time::Duration;
use tauri::Url;

const MAX_FEED_BYTES: usize = 4 * 1024 * 1024;
const GOOGLE_ICAL_HELP: &str = "Dans Google Agenda, copie « Adresse secrète au format iCal » dans les paramètres de cet agenda. Pour un agenda public, utilise son adresse publique au format iCal.";

fn is_google_calendar(url: &Url) -> bool {
    url.host_str() == Some("calendar.google.com")
}

fn feed_url(raw: &str) -> Result<Url, String> {
    let raw = raw.trim();
    let https = raw
        .strip_prefix("webcal://")
        .map(|rest| format!("https://{rest}"));
    let url = Url::parse(https.as_deref().unwrap_or(raw)).map_err(|_| "Lien iCal invalide.")?;
    if url.scheme() != "https"
        || url.host().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
    {
        return Err("Utilise un lien iCal HTTPS ou webcal sans identifiants intégrés.".into());
    }
    Ok(url)
}

#[tauri::command]
pub async fn calendar_feed(url: Option<String>) -> Result<Option<String>, String> {
    let vault_error = "Le Gestionnaire d’identifiants Windows est indisponible.";
    let entry = keyring::Entry::new("eu.usini.bete2.calendar", "ical").map_err(|_| vault_error)?;
    if url.as_deref() == Some("") {
        return match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err(vault_error.into()),
        };
    }
    let saved;
    let source = if let Some(value) = url.as_deref() {
        value
    } else {
        saved = match entry.get_password() {
            Ok(value) => value,
            Err(keyring::Error::NoEntry) => return Ok(None),
            Err(_) => return Err(vault_error.into()),
        };
        &saved
    };
    let endpoint = feed_url(source)?;
    let google = is_google_calendar(&endpoint);
    if google && !endpoint.path().starts_with("/calendar/ical/") {
        return Err(GOOGLE_ICAL_HELP.into());
    }
    let network_error = "Impossible de charger le calendrier. Vérifie le lien et ta connexion.";
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .referer(false)
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 4 || feed_url(attempt.url().as_str()).is_err() {
                attempt.stop()
            } else {
                attempt.follow()
            }
        }))
        .build()
        .map_err(|_| network_error)?;
    let mut response = client
        .get(endpoint.clone())
        .send()
        .await
        .map_err(|_| network_error)?;
    let status = response.status();
    if !status.is_success() {
        if google && matches!(status.as_u16(), 401 | 403 | 404 | 410) {
            return Err(format!(
                "Google refuse ce flux ({status}). {GOOGLE_ICAL_HELP}"
            ));
        }
        return Err(format!(
            "Le fournisseur a refusé le chargement du calendrier ({status})."
        ));
    }
    let too_large = "Le fichier iCal dépasse 4 Mio.";
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| network_error)? {
        if bytes.len() + chunk.len() > MAX_FEED_BYTES {
            return Err(too_large.into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let text =
        String::from_utf8(bytes).map_err(|_| "Le calendrier n’est pas au format iCal UTF-8.")?;
    let ics = text.trim_start_matches('\u{feff}').trim();
    if !ics
        .lines()
        .next()
        .is_some_and(|line| line.eq_ignore_ascii_case("BEGIN:VCALENDAR"))
        || !ics
            .lines()
            .last()
            .is_some_and(|line| line.eq_ignore_ascii_case("END:VCALENDAR"))
    {
        if google {
            return Err(GOOGLE_ICAL_HELP.into());
        }
        return Err("Le lien ne renvoie pas un calendrier iCal.".into());
    }
    if url.is_some() {
        entry
            .set_password(endpoint.as_str())
            .map_err(|_| vault_error)?;
    }
    Ok(Some(ics.to_owned()))
}
