@echo off
title Subir Cambios a Produccion - Lacteos Trujillos
echo ========================================================
echo   SUBIENDO CAMBIOS A PRODUCCION (GITHUB + RENDER)
echo ========================================================
echo.
echo Se van a enviar las mejoras de:
echo  1. Rutas estrictas por microzonas (1 solo municipio al dia).
echo  2. Captura hasta milesimas en Produccion (0.001 kg).
echo  3. Boton directo y bitacora para Historial GPS (Google Sheets).
echo  4. Anticipacion y voz coloquial de navegacion en mapa.
echo  5. Sincronizacion de Catalogo Odoo a Google Sheets (Catalogo_Productos).
echo  6. Correccion y clasificacion estricta de categorias (Mozzarella, etc.).
echo  7. Boton y modal para Gerencia/Admin de actualizacion de productos.
echo.
"C:\Users\truji\.gemini\antigravity\scratch\mingit\cmd\git.exe" push origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo ========================================================
    echo   [EXITO] Cambios enviados a GitHub correctamente!
    echo   Render comenzara el despliegue a produccion.
    echo ========================================================
) else (
    echo.
    echo Si el token expiro o se abrio una ventana del navegador,
    echo inicia sesion en GitHub para autorizar el envio.
)
echo.
pause
