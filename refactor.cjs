const fs = require('fs');
let code = fs.readFileSync('src/pages/FinanceDashboard.jsx', 'utf8');

// remove FinanceFilterSelect implementation
code = code.replace(/const FILTER_EMPTY_VALUE[\s\S]*?<\/Select>\n\);\n/, '');

// replace usage
code = code.replace(/<FinanceFilterSelect/g, '<FilterSelect');
code = code.replace(/<\/FinanceFilterSelect>/g, '</FilterSelect>');

// replace import
code = code.replace(/import \{ Select, SelectContent, SelectItem, SelectTrigger, SelectValue \} from '\.\.\/components\/ui\/select';\n/, "import { FilterSelect } from '../components/ui/FilterSelect';\n");

fs.writeFileSync('src/pages/FinanceDashboard.jsx', code);
