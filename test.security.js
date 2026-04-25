// Security logic unit tests - no network required

function stripHTML(input) { return input.replace(/<[^>]*>/g, ''); }
function escapeHTML(input) {
  return input.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#x27;').replace(/\//g,'&#x2F;');
}
function stripControlChars(input) { return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,''); }
function sanitizeString(input, maxLength=500) {
  if (typeof input !== 'string') return '';
  return stripControlChars(stripHTML(input.trim())).slice(0, maxLength);
}
function isValidUsername(u) { return /^[a-zA-Z0-9_]{3,30}$/.test(u); }
function isValidPassword(p) { return typeof p === 'string' && p.length >= 8 && p.length <= 128; }
const SQL_PATTERNS = [
  /(\b)(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE)(\b)/i,
  /('|--|;|\/\*|\*\/|xp_|CAST\s*\(|CONVERT\s*\()/i,
  /(OR|AND)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i
];
function hasSQLInjection(s) { return SQL_PATTERNS.some(p => p.test(s)); }
function hasNoSQLInjection(s) { return /(\$where|\$ne|\$gt|\$lt|\$regex|\$exists|\$or|\$and)/.test(s); }
function hasPathTraversal(s) { return /(\.\.[\/\\]|[\/\\]\.\.)/.test(decodeURIComponent(s)); }
function checkInputThreats(input) {
  if (hasSQLInjection(input))      return { safe: false, reason: 'SQL injection' };
  if (hasNoSQLInjection(input))    return { safe: false, reason: 'NoSQL injection' };
  if (hasPathTraversal(input))     return { safe: false, reason: 'Path traversal' };
  if (/<script[\s>]/i.test(input)) return { safe: false, reason: 'Script injection' };
  if (/javascript:/i.test(input))  return { safe: false, reason: 'JS URI' };
  return { safe: true };
}

// Mock JWT for RBAC tests
function generateMockToken(userId, role) {
  const header  = Buffer.from(JSON.stringify({ alg:'HS256', typ:'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({ sub: userId, role, iat: Date.now() })).toString('base64');
  const sig     = Buffer.from('mock-sig').toString('base64');
  return header + '.' + payload + '.' + sig;
}
function decodeMockToken(token) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()); }
  catch { return null; }
}
function hasPermission(role, action) {
  const perms = { admin: ['read','write','delete','manage'], user: ['read','write'], guest: ['read'] };
  return (perms[role] || []).includes(action);
}

const tests = [
  // Input sanitization
  { name: 'stripHTML removes script tag',           got: stripHTML('<script>alert(1)</script>'),       want: 'alert(1)' },
  { name: 'escapeHTML encodes < and >',             got: escapeHTML('<img>'),                          want: '&lt;img&gt;' },
  { name: 'sanitizeString strips HTML + trims',     got: sanitizeString('  <b>hello</b>  '),          want: 'hello' },
  { name: 'sanitizeString enforces maxLength',      got: sanitizeString('a'.repeat(600), 100).length, want: 100 },
  { name: 'sanitizeString rejects non-string',      got: sanitizeString(42),                          want: '' },
  { name: 'sanitizeString removes null byte',       got: sanitizeString('hel\x00lo'),                 want: 'hello' },

  // Username validation
  { name: 'isValidUsername: alphanumeric OK',       got: isValidUsername('admin123'),   want: true },
  { name: 'isValidUsername: underscore OK',         got: isValidUsername('zoriah_dev'), want: true },
  { name: 'isValidUsername: space rejected',        got: isValidUsername('bad user'),   want: false },
  { name: 'isValidUsername: too short (<3)',        got: isValidUsername('ab'),         want: false },
  { name: 'isValidUsername: too long (>30)',        got: isValidUsername('a'.repeat(31)), want: false },
  { name: 'isValidUsername: SQL chars rejected',    got: isValidUsername("admin'--"),   want: false },

  // Password validation
  { name: 'isValidPassword: valid password OK',     got: isValidPassword('password123'), want: true },
  { name: 'isValidPassword: short rejected',        got: isValidPassword('abc'),         want: false },
  { name: 'isValidPassword: null rejected',         got: isValidPassword(null),          want: false },
  { name: 'isValidPassword: too long rejected',     got: isValidPassword('a'.repeat(129)), want: false },

  // SQL injection detection
  { name: "SQL: OR 1=1 blocked",                   got: checkInputThreats("' OR '1'='1").safe, want: false },
  { name: "SQL: UNION SELECT blocked",              got: checkInputThreats('UNION SELECT * FROM users').safe, want: false },
  { name: "SQL: DROP TABLE blocked",               got: checkInputThreats('DROP TABLE users').safe, want: false },
  { name: "SQL: comment -- blocked",               got: checkInputThreats("admin'--").safe, want: false },
  { name: "NoSQL: \$where blocked",                got: checkInputThreats('{$where:"1==1"}').safe, want: false },
  { name: "NoSQL: \$ne blocked",                   got: checkInputThreats('{$ne:null}').safe, want: false },
  { name: "Path: ../ blocked",                     got: checkInputThreats('../etc/passwd').safe, want: false },
  { name: "Path: ..%2F blocked (URL encoded)",     got: checkInputThreats('..%2Fetc%2Fpasswd').safe, want: false },
  { name: "XSS: <script blocked",                  got: checkInputThreats('<script>alert(1)').safe, want: false },
  { name: "XSS: javascript: URI blocked",          got: checkInputThreats('javascript:alert(1)').safe, want: false },
  { name: "Clean input: hello world passes",       got: checkInputThreats('hello world').safe, want: true },
  { name: "Clean input: admin passes",             got: checkInputThreats('admin').safe, want: true },
  { name: "Clean input: email address passes",     got: checkInputThreats('user@example.com').safe, want: true },

  // JWT + RBAC
  { name: "JWT: encode/decode round-trip",
    got: decodeMockToken(generateMockToken('alice','user')).role, want: 'user' },
  { name: "JWT: admin role decoded correctly",
    got: decodeMockToken(generateMockToken('admin','admin')).sub, want: 'admin' },
  { name: "JWT: invalid token returns null",
    got: decodeMockToken('not.a.token'), want: null },

  // RBAC permissions
  { name: "RBAC: admin can delete",                got: hasPermission('admin','delete'),  want: true },
  { name: "RBAC: admin can manage",                got: hasPermission('admin','manage'),  want: true },
  { name: "RBAC: user can read",                   got: hasPermission('user','read'),     want: true },
  { name: "RBAC: user can write",                  got: hasPermission('user','write'),    want: true },
  { name: "RBAC: user CANNOT delete",             got: hasPermission('user','delete'),   want: false },
  { name: "RBAC: user CANNOT manage",             got: hasPermission('user','manage'),   want: false },
  { name: "RBAC: guest can only read",             got: hasPermission('guest','read'),    want: true },
  { name: "RBAC: guest CANNOT write",             got: hasPermission('guest','write'),   want: false },
  { name: "RBAC: guest CANNOT delete",            got: hasPermission('guest','delete'),  want: false },
  { name: "RBAC: unknown role has no perms",       got: hasPermission('hacker','delete'), want: false },
];

let passed = 0, failed = 0;
for (const t of tests) {
  const ok = JSON.stringify(t.got) === JSON.stringify(t.want);
  if (ok) { console.log('PASS', t.name); passed++; }
  else    { console.log('FAIL', t.name, '| got:', t.got, '| want:', t.want); failed++; }
}

console.log('');
console.log('Results:', passed + '/' + tests.length + ' passed' + (failed > 0 ? ', ' + failed + ' FAILED' : ' - ALL PASSED'));
process.exit(failed > 0 ? 1 : 0);
