param(
    [string]$BaseLocal = 'http://127.0.0.1:5678',
    [string]$BasePublica = 'https://tubular-staunch-impromptu.ngrok-free.dev'
)

& {
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.Net.Http
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $cliente = [System.Net.Http.HttpClient]::new($handler)
    $cliente.Timeout = [TimeSpan]::FromSeconds(30)

    $casos = @(
        [pscustomobject]@{ Nombre='201 fijo'; Ruta='/webhook/eventpass/diagnostico/http/fijo'; Esperado=201; Tipo='fija'; Valido=$null }
    )
    foreach ($codigo in @(200,201,400,401,403,409,503)) {
        $casos += [pscustomobject]@{
            Nombre="Dinámico $codigo"
            Ruta="/webhook/eventpass/diagnostico/http?codigo=$codigo"
            Esperado=$codigo
            Tipo='dinamica'
            Valido=$true
        }
    }
    $casos += [pscustomobject]@{ Nombre='Parámetro inválido'; Ruta='/webhook/eventpass/diagnostico/http?codigo=999'; Esperado=400; Tipo='dinamica'; Valido=$false }
    $casos += [pscustomobject]@{ Nombre='Sin parámetro'; Ruta='/webhook/eventpass/diagnostico/http'; Esperado=400; Tipo='dinamica'; Valido=$false }

    $resultados = @()
    try {
        foreach ($entorno in @(
            [pscustomobject]@{ Nombre='Local'; Base=$BaseLocal },
            [pscustomobject]@{ Nombre='Ngrok'; Base=$BasePublica }
        )) {
            Write-Host "Probando $($entorno.Nombre)..."
            foreach ($caso in $casos) {
                $peticion = $null
                $respuesta = $null
                $recibido = $null
                $cronometro = [System.Diagnostics.Stopwatch]::StartNew()
                try {
                    $url = $entorno.Base.TrimEnd('/') + $caso.Ruta
                    $peticion = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get,$url)
                    $peticion.Headers.Add('Accept','application/json')
                    $peticion.Headers.Add('ngrok-skip-browser-warning','1')
                    $respuesta = $cliente.SendAsync($peticion).GetAwaiter().GetResult()
                    $recibido = [int]$respuesta.StatusCode
                    $texto = $respuesta.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                    $cuerpo = ConvertFrom-Json -InputObject $texto -ErrorAction Stop
                    $correcta = (
                        $recibido -eq $caso.Esperado -and
                        $cuerpo.diagnostico -ceq 'eventpass-http-v1' -and
                        $cuerpo.prueba -ceq $caso.Tipo -and
                        $cuerpo.codigo_esperado -eq $caso.Esperado -and
                        $cuerpo.ok -is [bool] -and
                        $cuerpo.ok -eq ($caso.Esperado -ge 200 -and $caso.Esperado -lt 300)
                    )
                    if ($caso.Tipo -eq 'dinamica') {
                        $correcta = $correcta -and ($cuerpo.parametro_valido -is [bool]) -and ($cuerpo.parametro_valido -eq $caso.Valido)
                    }
                    $detalle = ''
                    if (-not $correcta) { $detalle = 'Estado HTTP o cuerpo distinto al diagnóstico esperado.' }
                    $resultados += [pscustomobject]@{ Entorno=$entorno.Nombre; Prueba=$caso.Nombre; Esperado=$caso.Esperado; Recibido=$recibido; Correcta=[bool]$correcta; Ms=$cronometro.ElapsedMilliseconds; Detalle=$detalle }
                }
                catch {
                    $resultados += [pscustomobject]@{ Entorno=$entorno.Nombre; Prueba=$caso.Nombre; Esperado=$caso.Esperado; Recibido=$recibido; Correcta=$false; Ms=$cronometro.ElapsedMilliseconds; Detalle=$_.Exception.Message }
                }
                finally {
                    $cronometro.Stop()
                    if ($null -ne $respuesta) { $respuesta.Dispose() }
                    if ($null -ne $peticion) { $peticion.Dispose() }
                }
            }
        }
        $resultados | Format-Table Entorno,Prueba,Esperado,Recibido,Correcta,Ms -AutoSize | Out-Host
        $fallos = @($resultados | Where-Object { -not $_.Correcta })
        if ($fallos.Count -eq 0) {
            Write-Host '20/20 comprobaciones HTTP satisfactorias en el flujo aislado.'
            Write-Host 'Todavía falta repetir las pruebas de los flujos reales de EventPass.'
        }
        else {
            Write-Host "$($fallos.Count) comprobaciones fallaron:"
            $fallos | Format-List | Out-Host
            Write-Host 'Si hay HTTP 404, verifica que TEST_HTTP_EventPass esté importado y publicado.'
        }
    }
    finally { $cliente.Dispose() }
}
