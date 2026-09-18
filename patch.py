import re

with open('server/algorithm.ts', 'r') as f:
    content = f.read()

content = content.replace(r"\`", "`").replace(r"\$", "$")

with open('server/algorithm.ts', 'w') as f:
    f.write(content)
