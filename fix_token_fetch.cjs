const fs = require('fs');
let code = fs.readFileSync('src/components/CommissionsView.tsx', 'utf8');

code = code.replace(
  "  useEffect(() => {\n    fetchCommissions();\n  }, [token]);",
  "  useEffect(() => {\n    if (token) fetchCommissions();\n  }, [token]);"
);

fs.writeFileSync('src/components/CommissionsView.tsx', code);

// Check if any other views do this.
