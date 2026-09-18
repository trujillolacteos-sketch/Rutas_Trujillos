# Correcciones de comisiones

Reglas implementadas:

1. Sólo ventas de Punto de Venta con cliente asignado generan comisión.
2. Borradores y cancelaciones no generan comisión.
3. Ventas de contado quedan cubiertas de inmediato.
4. Ventas con método Customer Account / Cuenta de cliente quedan pendientes hasta liquidación.
5. Una liquidación manual ya no se pierde en la siguiente sincronización de Odoo.
6. Comisión = venta × porcentaje según tipo de cliente × multiplicador de ajuste.
7. El multiplicador se configura en Ajustes. 1.00 = sin ajuste.
8. Se corrigió el endpoint /liquidate, que estaba anidado dentro de /pay.

Nota: esta corrección conserva la liquidación manual. No implementa conciliación contable automática de créditos en Odoo, porque el código original no consulta movimientos/conciliaciones de cuentas por cobrar.
