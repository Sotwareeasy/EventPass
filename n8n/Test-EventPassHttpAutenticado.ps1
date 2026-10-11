param(
    [string]$BaseLocal = 'http://127.0.0.1:5678',
    [string]$BasePublica = 'https://tubular-staunch-impromptu.ngrok-free.dev',
    [ValidateRange(0, 60)]
    [int]$PausaEntrePruebas = 15,
    [switch]$SoloSinSesion
)

& {
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.Net.Http
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $cliente = [System.Net.Http.HttpClient]::new($handler)
    $cliente.Timeout = [TimeSpan]::FromSeconds(60)
    $curlRuta = (Get-Command curl.exe -ErrorAction Stop).Source
    $credencial = $null
    $loginDatos = $null
    $login = $null
    $token = $null

    function Invoke-EpHttp {
        param([string]$Url, [hashtable]$Datos, [string]$Token = '')
        $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, $Url)
        $response = $null
        try {
            $request.Headers.Add('Accept', 'application/json')
            $request.Headers.Add('ngrok-skip-browser-warning', '1')
            $request.Headers.ExpectContinue = $false
            if ($Token) {
                $request.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $Token)
            }
            $json = ConvertTo-Json -InputObject $Datos -Depth 6 -Compress
            $request.Content = [System.Net.Http.StringContent]::new($json, [System.Text.Encoding]::UTF8, 'application/json')
            $response = $cliente.SendAsync($request).GetAwaiter().GetResult()
            $status = [int]$response.StatusCode
            $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            try { $body = ConvertFrom-Json -InputObject $text -ErrorAction Stop }
            catch { throw "HttpClient: HTTP $status con respuesta no JSON." }
            [pscustomobject]@{ HTTP = $status; Json = $body }
        }
        finally {
            if ($null -ne $response) { $response.Dispose() }
            $request.Dispose()
        }
    }

    function ConvertTo-CurlQuoted {
        param([string]$Text)
        '"' + $Text.Replace('\', '\\').Replace('"', '\"').Replace("`r", '\r').Replace("`n", '\n') + '"'
    }

    function Invoke-EpCurl {
        param([string]$Url, [hashtable]$Datos, [string]$Token = '')
        $json = ConvertTo-Json -InputObject $Datos -Depth 6 -Compress
        $config = @(
            'silent'
            'show-error'
            'http1.1'
            'max-time = 60'
            'connect-timeout = 15'
            'request = "POST"'
            ('url = ' + (ConvertTo-CurlQuoted $Url))
            'header = "Content-Type: application/json"'
            'header = "Accept: application/json"'
            'header = "ngrok-skip-browser-warning: 1"'
            ('data-binary = ' + (ConvertTo-CurlQuoted $json))
            'write-out = "\nEP_HTTP=%{http_code}\n"'
        )
        if ($Token) { $config += 'header = ' + (ConvertTo-CurlQuoted "Authorization: Bearer $Token") }

        # El token se transmite por stdin: no aparece en los argumentos ni se guarda en disco.
        $process = [System.Diagnostics.Process]::new()
        $process.StartInfo.FileName = $curlRuta
        $process.StartInfo.Arguments = '-q --config -'
        $process.StartInfo.UseShellExecute = $false
        $process.StartInfo.CreateNoWindow = $true
        $process.StartInfo.RedirectStandardInput = $true
        $process.StartInfo.RedirectStandardOutput = $true
        $process.StartInfo.RedirectStandardError = $true
        try {
            $null = $process.Start()
            $outTask = $process.StandardOutput.ReadToEndAsync()
            $errTask = $process.StandardError.ReadToEndAsync()
            $process.StandardInput.Write(($config -join "`n") + "`n")
            $process.StandardInput.Close()
            if (-not $process.WaitForExit(70000)) {
                $process.Kill()
                throw 'curl excedio el tiempo de espera.'
            }
            $outputText = $outTask.GetAwaiter().GetResult()
            $errorText = $errTask.GetAwaiter().GetResult()
            if ($process.ExitCode -ne 0) { throw "curl fallo: $errorText" }
            if ($outputText -notmatch '(?s)^(.*)\nEP_HTTP=(\d{3})\s*$') {
                throw 'curl no devolvio el marcador de estado HTTP.'
            }
            $status = [int]$Matches[2]
            $bodyText = $Matches[1]
            try { $body = ConvertFrom-Json -InputObject $bodyText -ErrorAction Stop }
            catch { throw "curl: HTTP $status con respuesta no JSON." }
            [pscustomobject]@{ HTTP = $status; Json = $body }
        }
        finally { $config = $null; $process.Dispose() }
    }

    try {
        if (-not $SoloSinSesion) {
            $credencial = Get-Credential -Message 'Cuenta EventPass que ya tiene la inscripcion en EVT-169'
            if ($null -eq $credencial) { Write-Host 'Prueba cancelada.'; return }
            $loginDatos = @{ email = $credencial.UserName.Trim(); password = $credencial.GetNetworkCredential().Password }
            $login = Invoke-EpHttp -Url ($BaseLocal.TrimEnd('/') + '/webhook/eventpass/auth/login') -Datos $loginDatos
            $loginDatos = $null
            $credencial = $null
            $token = $login.Json.data.sesion.token
            if ($login.HTTP -ne 200 -or $login.Json.ok -isnot [bool] -or $login.Json.ok -ne $true -or $token -isnot [string] -or $token -cnotmatch '^ep_[A-Za-z0-9_-]{43}$') {
                throw "Login no valido. HTTP: $($login.HTTP)."
            }
            if ($login.Json.data.usuario.usuario_id -cne 'USR-0c37469a0045509ab509952c9ad1d6a9') {
                throw 'Cuenta diferente a la que tiene la inscripcion existente. No se envio ninguna prueba de inscripcion.'
            }
            Write-Host 'Login correcto. Usuario esperado verificado. Token oculto.'
        }

        $casos = @([pscustomobject]@{ Nombre = 'Sin token'; Token = ''; Body = @{}; Status = 401; Codigo = 'SESION_INVALIDA' })
        if (-not $SoloSinSesion) {
            $casos += [pscustomobject]@{ Nombre = 'Nombre vacio'; Token = $token; Body = @{ evento_id = 'EVT-169'; nombre_acreditacion = ''; observaciones = '' }; Status = 400; Codigo = 'SOLICITUD_INSCRIPCION_INVALIDA' }
            $casos += [pscustomobject]@{ Nombre = 'Duplicado'; Token = $token; Body = @{ evento_id = 'EVT-169'; nombre_acreditacion = 'Participante de pruebas'; observaciones = '' }; Status = 409; Codigo = 'INSCRIPCION_DUPLICADA' }
        }
        $resultados = @()
        foreach ($entorno in @([pscustomobject]@{ Nombre = 'Local'; Base = $BaseLocal }, [pscustomobject]@{ Nombre = 'Ngrok'; Base = $BasePublica })) {
            foreach ($caso in $casos) {
                foreach ($metodo in @('HttpClient', 'curl')) {
                    if ($caso.Token -and $PausaEntrePruebas -gt 0) {
                        Write-Host "Pausa de $PausaEntrePruebas segundos antes de la prueba autenticada..."
                        Start-Sleep -Seconds $PausaEntrePruebas
                    }
                    Write-Host "Probando $($entorno.Nombre) / $metodo / $($caso.Nombre)..."
                    $watch = [System.Diagnostics.Stopwatch]::StartNew()
                    $received = $null
                    try {
                        $url = $entorno.Base.TrimEnd('/') + '/webhook/eventpass/inscripciones'
                        if ($metodo -eq 'curl') { $r = Invoke-EpCurl -Url $url -Datos $caso.Body -Token $caso.Token }
                        else { $r = Invoke-EpHttp -Url $url -Datos $caso.Body -Token $caso.Token }
                        $received = $r.HTTP
                        $correcta = ($r.HTTP -eq $caso.Status -and $r.Json.ok -is [bool] -and $r.Json.ok -eq $false -and $r.Json.error.codigo -ceq $caso.Codigo)
                        $resultados += [pscustomobject]@{ Entorno = $entorno.Nombre; Cliente = $metodo; Prueba = $caso.Nombre; Esperado = $caso.Status; Recibido = $received; Correcta = $correcta; Codigo = $r.Json.error.codigo; Ms = $watch.ElapsedMilliseconds; Detalle = '' }
                        if ($caso.Nombre -eq 'Duplicado' -and $r.Json.ok -eq $true) {
                            $resultados | Format-Table -AutoSize | Out-Host
                            throw 'La solicitud duplicada devolvio exito. Deten la prueba y revisa EP06 antes de reintentar.'
                        }
                    }
                    catch {
                        $resultados += [pscustomobject]@{ Entorno = $entorno.Nombre; Cliente = $metodo; Prueba = $caso.Nombre; Esperado = $caso.Status; Recibido = $received; Correcta = $false; Codigo = ''; Ms = $watch.ElapsedMilliseconds; Detalle = $_.Exception.Message }
                        if ($caso.Nombre -eq 'Duplicado') {
                            $resultados | Format-List | Out-Host
                            throw 'Se detuvo el diagnostico durante la prueba de duplicado. Revisa EP06 antes de repetir.'
                        }
                    }
                    finally { $watch.Stop() }
                }
            }
        }
        $resultados | Format-Table Entorno,Cliente,Prueba,Esperado,Recibido,Correcta,Codigo,Ms -AutoSize | Out-Host
        $fallos = @($resultados | Where-Object { -not $_.Correcta })
        Write-Host ("Resultado: {0}/{1} pruebas satisfactorias." -f ($resultados.Count - $fallos.Count), $resultados.Count)
        if ($fallos.Count -gt 0) { $fallos | Format-List | Out-Host }
        if (-not $SoloSinSesion) { Write-Host 'Comprueba que Inscripciones y Auditoria_Inscripciones no tengan filas nuevas.' }
    }
    catch { Write-Host ("DIAGNOSTICO DETENIDO: {0}" -f $_.Exception.Message) }
    finally {
        $credencial = $null; $loginDatos = $null; $login = $null; $token = $null; $casos = $null; $caso = $null
        $cliente.Dispose()
    }
}
