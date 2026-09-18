import re

with open('server/algorithm.ts', 'r') as f:
    content = f.read()

content = content.replace(r"\`Se encontraron \${invalidClients.length} clientes sin coordenadas. Se agruparán al final.\`", 
                          "'Se encontraron ' + invalidClients.length + ' clientes sin coordenadas. Se agruparán al final.'")

content = content.replace(r"\`v-inv-\${c.id}-\${actualDay}-\${v}\`", 
                          "'v-inv-' + c.id + '-' + actualDay + '-' + v")

content = content.replace(r"\`Balanceo diario corregido. Total visitas: \${allVisits.length}\`", 
                          "'Balanceo diario corregido. Total visitas: ' + allVisits.length")

with open('server/algorithm.ts', 'w') as f:
    f.write(content)
