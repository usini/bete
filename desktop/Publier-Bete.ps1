$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()

$desktopRoot = $PSScriptRoot
$root = Split-Path -Parent $desktopRoot
$config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'src-tauri/tauri.conf.json') -Raw | ConvertFrom-Json
$outputRoot = Join-Path $PSScriptRoot 'release-output'
$last = [version]$config.version
if (Test-Path -LiteralPath $outputRoot) {
    foreach ($folder in Get-ChildItem -LiteralPath $outputRoot -Directory) {
        if ($folder.Name -match '^bete-desktop-v([0-9]+\.[0-9]+\.[0-9]+)$' -and
            (Test-Path -LiteralPath (Join-Path $folder.FullName 'bete-desktop-latest.json'))) {
            $builtVersion = [version]($folder.Name.Substring(14))
            if ($builtVersion -gt $last) { $last = $builtVersion }
        }
    }
}
$defaultOAuthPath = Join-Path (Split-Path $root -Parent) 'GoogleSecrets.txt'

$form = New-Object Windows.Forms.Form
$form.Text = 'Bête · Préparer une version Windows'
$form.ClientSize = New-Object Drawing.Size(670, 570)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.Font = New-Object Drawing.Font('Segoe UI', 10)

function Add-Label($text, $y) {
    $control = New-Object Windows.Forms.Label
    $control.Text = $text
    $control.SetBounds(20, $y, 630, 24)
    $form.Controls.Add($control)
    return $control
}

function Add-Field($y, $width) {
    $control = New-Object Windows.Forms.TextBox
    $control.SetBounds(20, $y, $width, 27)
    $form.Controls.Add($control)
    return $control
}

function Add-Button($text, $x, $y, $width) {
    $control = New-Object Windows.Forms.Button
    $control.Text = $text
    $control.SetBounds($x, $y, $width, 30)
    $form.Controls.Add($control)
    return $control
}

function Choose-File($title, $filter) {
    $picker = New-Object Windows.Forms.OpenFileDialog
    try {
        $picker.Title = $title
        $picker.Filter = $filter
        if ($picker.ShowDialog($form) -eq 'OK') { return $picker.FileName }
    } finally { $picker.Dispose() }
}

$null = Add-Label 'Fichier de clé privée Tauri (facultatif)' 16
$keyPath = Add-Field 42 495
$keyBrowse = Add-Button 'Parcourir…' 525 39 125
$keyBrowse.Add_Click({
    $chosen = Choose-File 'Choisir la clé privée Tauri' 'Clés Tauri (*.key)|*.key|Tous les fichiers (*.*)|*.*'
    if ($chosen) {
        $keyPath.Text = $chosen
        if (Test-Path -LiteralPath ($chosen + '.pub') -PathType Leaf) {
            $publicKey.Text = (Get-Content -LiteralPath ($chosen + '.pub') -Raw).Trim()
        }
    }
})

$null = Add-Label 'Ou colle la clé privée Tauri depuis KeePass' 76
$privateKey = Add-Field 101 630
$privateKey.UseSystemPasswordChar = $true

$null = Add-Label 'Clé publique Tauri (colle la valeur Public key)' 135
$publicKey = Add-Field 160 630

$null = Add-Label 'Mot de passe de la clé (si elle est protégée)' 194
$password = Add-Field 219 495
$password.UseSystemPasswordChar = $true

$null = Add-Label 'Version Windows (X.Y.Z)' 253
$version = Add-Field 278 160
$version.Text = '{0}.{1}.0' -f $last.Major, ($last.Minor + 1)

$drive = New-Object Windows.Forms.CheckBox
$drive.Text = 'Activer Google Drive'
$drive.SetBounds(20, 315, 630, 25)
$drive.Checked = Test-Path -LiteralPath $defaultOAuthPath -PathType Leaf
$form.Controls.Add($drive)

$null = Add-Label 'Identifiant OAuth Desktop (facultatif si GoogleSecrets.txt existe)' 345
$oauthId = Add-Field 369 630
$null = Add-Label 'Secret OAuth Desktop' 402
$oauthSecret = Add-Field 426 630
$oauthSecret.UseSystemPasswordChar = $true

$build = Add-Button 'Compiler la version signée' 20 469 235
$open = Add-Button 'Ouvrir les fichiers générés' 265 469 230
$open.Enabled = $false
$status = Add-Label 'Les fichiers seront générés localement.' 514
$status.Height = 48

$script:buildProcess = $null
$script:buildOutput = $null
$timer = New-Object Windows.Forms.Timer
$timer.Interval = 350
$timer.Add_Tick({
    if (!$script:buildProcess.HasExited) { return }
    $timer.Stop()
    $code = $script:buildProcess.ExitCode
    $script:buildProcess.Dispose()
    $script:buildProcess = $null
    $build.Enabled = $true
    $keyBrowse.Enabled = $true
    $open.Enabled = $code -eq 0
    if ($code -eq 0) {
        $status.Text = 'Version signée prête. Tu peux ouvrir le dossier des fichiers.'
        $built = [version]$script:buildVersion
        $version.Text = '{0}.{1}.0' -f $built.Major, ($built.Minor + 1)
    } else {
        $status.Text = 'Le build a échoué. Vérifie la clé, son mot de passe et les outils de compilation.'
    }
})

$open.Add_Click({ if ($script:buildOutput) { Invoke-Item -LiteralPath $script:buildOutput } })
$form.Add_FormClosing({ param($sender, $event)
    if ($script:buildProcess) { $event.Cancel = $true }
})
$build.Add_Click({
    $open.Enabled = $false
    $start = $null
    $stage = "vérification de la clé privée"
    try {
        $number = $version.Text.Trim()
        if ($number -notmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$' -or
            $null -eq ($parsed = $number -as [version])) {
            $status.Text = 'Utilise un numéro de version comme 0.2.0.'
            return
        }
        $private = $privateKey.Text.Trim()
        $public = $publicKey.Text.Trim()
        if (!$private) {
            $selectedPath = $keyPath.Text.Trim().Trim('"')
            if (!$selectedPath -or !(Test-Path -LiteralPath $selectedPath -PathType Leaf)) {
                $status.Text = 'Colle la clé privée Tauri ou sélectionne son fichier.'
                return
            }
            $file = Get-Item -LiteralPath $selectedPath
            if ($file.Name.EndsWith('.pub', [StringComparison]::OrdinalIgnoreCase)) {
                $status.Text = 'Choisis le fichier de la clé privée.'
                return
            }
            if ($file.FullName.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
                $status.Text = 'Déplace la clé hors du dépôt avant de la sélectionner.'
                return
            }
            $private = $file.FullName
            if (!$public -and (Test-Path -LiteralPath ($private + '.pub') -PathType Leaf)) {
                $public = (Get-Content -LiteralPath ($private + '.pub') -Raw).Trim()
            }
        }
        if (!$public) {
            $status.Text = 'Colle la clé publique Tauri dans le champ prévu.'
            return
        }

        $stage = 'recherche de Node.js et de Tauri'
        $node = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if (!$node) {
            $status.Text = 'Node.js est introuvable. Installe-le ou relance cet outil après son installation.'
            return
        }
        if (!(Test-Path -LiteralPath (Join-Path $desktopRoot 'node_modules/@tauri-apps/cli/tauri.js') -PathType Leaf)) {
            $status.Text = 'Tauri est introuvable. Lance npm ci dans le dossier desktop.'
            return
        }
        $stage = 'préparation du processus'
        $start = New-Object Diagnostics.ProcessStartInfo
        $start.FileName = $node.Source
        $start.Arguments = 'release.mjs ' + $number
        $start.WorkingDirectory = $desktopRoot
        $start.UseShellExecute = $false
        $start.CreateNoWindow = $true
        $start.EnvironmentVariables['TAURI_SIGNING_PRIVATE_KEY'] = $private
        $start.EnvironmentVariables['TAURI_SIGNING_PRIVATE_KEY_PASSWORD'] = $password.Text
        $start.EnvironmentVariables['BETE_UPDATER_PUBLIC_KEY'] = $public
        $start.EnvironmentVariables.Remove('BETE_GOOGLE_DESKTOP_CLIENT_ID')
        $start.EnvironmentVariables.Remove('BETE_GOOGLE_DESKTOP_CLIENT_SECRET')
        if ($drive.Checked) {
            $stage = 'configuration de Google Drive'
            $clientId = $oauthId.Text.Trim()
            $clientSecret = $oauthSecret.Text.Trim()
            if (!$clientId -and !$clientSecret -and (Test-Path -LiteralPath $defaultOAuthPath -PathType Leaf)) {
                $oauth = Get-Content -LiteralPath $defaultOAuthPath
                if ($oauth.Count -ge 2) {
                    $clientId = $oauth[0].Trim()
                    $clientSecret = $oauth[1].Trim()
                }
            }
            if ($clientId -notmatch '^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$' -or !$clientSecret) {
                $status.Text = 'Renseigne les deux valeurs OAuth Desktop pour activer Google Drive.'
                return
            }
            $start.EnvironmentVariables['BETE_GOOGLE_DESKTOP_CLIENT_ID'] = $clientId
            $start.EnvironmentVariables['BETE_GOOGLE_DESKTOP_CLIENT_SECRET'] = $clientSecret
        }
        $stage = 'lancement de Node.js'
        $script:buildProcess = [Diagnostics.Process]::Start($start)
        $script:buildVersion = $number
        $script:buildOutput = Join-Path $outputRoot ('bete-desktop-v' + $number)
        $status.Text = 'Compilation de Bête ' + $number + '…'
        $build.Enabled = $false
        $keyBrowse.Enabled = $false
        $timer.Start()
    } catch {
        $status.Text = 'Build bloqué pendant ' + $stage + ' (' + $_.Exception.GetType().Name + ').'
    } finally {
        if ($script:buildProcess) {
            $privateKey.Clear()
            $password.Clear()
            $oauthSecret.Clear()
        }
        if ($start) {
            foreach ($name in @('TAURI_SIGNING_PRIVATE_KEY_PASSWORD', 'TAURI_SIGNING_PRIVATE_KEY', 'BETE_GOOGLE_DESKTOP_CLIENT_SECRET')) {
                $start.EnvironmentVariables.Remove($name)
            }
        }
    }
})
try { [void]$form.ShowDialog() }
finally { $timer.Dispose(); $form.Dispose() }
