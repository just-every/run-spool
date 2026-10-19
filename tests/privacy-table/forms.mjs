const b64 = s => Buffer.from(s).toString('base64');
// Provider shapes are built at runtime or explicitly marked synthetic examples.
// Each planted credential still has a canary that must disappear after scrubbing.
const aws = 'AKI' + 'A', awsSession = 'ASI' + 'A', slack = 'xox' + 'b-', stripe = 'sk_' + 'live_';
const pem = (edge, tail = '') => `-----${edge} PRIVATE ` + `KEY${tail}-----`;
// [name, text planted in an event, parts that must not survive on any path].
// Every form a privacy review found leaking, and the forms it verified clean.
export const forms = [
 // spool-r1 review (11 Oct): keyed secrets.
 ['access_token=', 'oauth callback access_token=R1CNRYaccess&state=ok', ['R1CNRYaccess']],
 ['client_secret=', 'oauth client_secret=R1CNRYclient rejected', ['R1CNRYclient']],
 ['refresh_token:', 'refresh_token: R1CNRYrefresh', ['R1CNRYrefresh']],
 ['JSON "password"', '{"user":"amy","password":"R1CNRYjsonpw"}', ['R1CNRYjsonpw']],
 ['Authorization: Basic', 'Authorization: Basic ' + b64('amy:R1CNRYbasic'), [b64('amy:R1CNRYbasic')]],
 // Forms verified clean.
 ['AWS AKIA', 'upload failed for ' + aws + 'QX7P1CNRY2WJ5PL0 in us-east-1', [aws + 'QX7P1CNRY2WJ5PL0']],
 ['aws_secret_access_key', 'aws_secret_access_key = P2CNRYwJalrXUtnEMIK7MDENGbPxRfiCY', ['P2CNRYwJalr']],
 ['GitHub ghp_', 'git push failed using synthetic-example-ghp_P3CNRYabcdefghijklmnopqrstuvwxyz0123', ['ghp_P3CNRY']],
 ['Slack xoxb-', 'slack post failed ' + slack + '1234567890-0987654321-P4CNRYslackbot', ['P4CNRYslackbot']],
 ['Stripe sk_live_', 'stripe error with ' + stripe + '51P5CNRYabcdefghijklmnopqrstu', ['P5CNRYabcdef']],
 ['PEM RSA block', 'key load\n' + pem('BEGIN RSA') + '\nMIIEowP6CNRYbody\nP6CNRYline2\n' + pem('END RSA') + '\ndone', ['P6CNRY']],
 ['password in URL query', 'GET https://api.example.com/login?user=amy&password=P7CNRYqpw 500', ['P7CNRYqpw']],
 ['password in relative query', 'GET /login?user=amy&password=P8CNRYrel 500', ['P8CNRYrel']],
 ['user:pass@host', 'connect postgres://app:P9CNRYpg@db.internal:5432/main refused; fetch https://amy:P9CNRYhttps@api.example.com/v1', ['P9CNRY']],
 ['cookie header dump', 'Request headers:\nHost: api.example.com\nCookie: theme=dark; sessionid=PACNRYsid; csrftoken=PACNRYcsrf\nAccept: */*', ['PACNRY']],
 ['Basic same line', 'Authorization: Basic ' + b64('amy:PBCNRYbasic'), [b64('amy:PBCNRYbasic')]],
 ['locals/tags/contexts/breadcrumb data style', 'locals: {username: "amy", password: "PCCNRYlocal"} tags: auth.token:PCCNRYtag context: {"db": {"password": "PCCNRYctx"}} data: {"api_key":"PCCNRYcrumb"}', ['PCCNRY']],
 ['nested escaped JSON', JSON.stringify(JSON.stringify({ auth: { token: 'PDCNRYesc', client_secret: 'PDCNRYcs' } })), ['PDCNRY']],
 ['long string, secret at 1000 boundary', 'x'.repeat(940) + ' password=PECNRYboundarysecretvalue', ['PECNRY']],
 // Forms that once leaked on every path.
 ['JSON password with escaped quote', JSON.stringify({ user: 'amy', password: 'Q1CNRY"Q1tail' }), ['Q1CNRY', 'Q1tail']],
 ['triple-stringified JSON password', JSON.stringify(JSON.stringify(JSON.stringify({ password: 'Q2CNRYdbl' }))), ['Q2CNRYdbl']],
 ['single-quoted password with escaped quote', "{'password': 'Q3CNRY\\'Q3tail'}", ['Q3CNRY', 'Q3tail']],
 ['Basic credential on next line', 'Authorization: Basic\n' + b64('amy:Q4CNRYsplitpw'), [b64('amy:Q4CNRYsplitpw')]],
 ['Basic credential split mid-value', 'Authorization: Basic ' + b64('amy:Q5CNRYsplitmid12').slice(0, 8) + '\n ' + b64('amy:Q5CNRYsplitmid12').slice(8), [b64('amy:Q5CNRYsplitmid12').slice(0, 8), b64('amy:Q5CNRYsplitmid12').slice(8)]],
 ['ODBC PWD=', 'Login failed: Driver={ODBC Driver 18};Server=db;UID=sa;PWD=Q6CNRYodbc;', ['Q6CNRYodbc']],
 ['passphrase=', 'ssh-add failed passphrase=Q7CNRYphrase', ['Q7CNRYphrase']],
 ['JSON "pass"', '{"user":"amy","pass":"Q8CNRYpass"}', ['Q8CNRYpass']],
 ['PGP private key block', pem('BEGIN PGP', ' BLOCK') + '\nlQOYBQ9CNRYpgp\n' + pem('END PGP', ' BLOCK'), ['Q9CNRYpgp']],
 ['Slack webhook URL', 'POST https://hooks.slack.com/services/T0/B0/QACNRYhook failed', ['QACNRYhook']],
 // Further forms that once leaked through scrub().
 ['Discord webhook URL', 'POST https://discord.com/api/webhooks/123/QBCNRYdiscordtok failed', ['QBCNRYdiscordtok']],
 ['JSON stringified twice, escaped quote', JSON.stringify(JSON.stringify({ password: 'QCCNRY"QCtail' })), ['QCCNRY', 'QCtail']],
 ['double-escaped JSON', '"{\\\\\\"password\\\\\\":\\\\\\"QDCNRYdblesc\\\\\\"}"', ['QDCNRYdblesc']],
 ['JSON value with escaped quotes', '{"password":"QECNRY\\"QEquoted\\"pw"}', ['QECNRY', 'QEquoted']],
 ['JSON multiline value', '{\n  "password":\n    "QFCNRYmultiline"\n}', ['QFCNRYmultiline']],
 ['YAML value on next line', 'password:\n  QGCNRYyamlnextline', ['QGCNRYyamlnextline']],
 ['Basic split over indented lines', 'Authorization: Basic\n  ' + b64('amy:QHCNRYsplitbasicpw').slice(0, 12) + '\n  ' + b64('amy:QHCNRYsplitbasicpw').slice(12), [b64('amy:QHCNRYsplitbasicpw').slice(0, 12), b64('amy:QHCNRYsplitbasicpw').slice(12)]],
 ['Basic split by tab continuation', 'Authorization: Basic ' + b64('amy:QICNRYcontinuepw').slice(0, 10) + '\n\t' + b64('amy:QICNRYcontinuepw').slice(10), [b64('amy:QICNRYcontinuepw').slice(10)]],
 ['Cookie continuation line', 'Cookie: a=1;\n b=QJCNRYcookie2', ['QJCNRYcookie2']],
 ['relative query pass=', 'fetch /api/login?user=amy&pass=QKCNRYrelpass failed', ['QKCNRYrelpass']],
 ['relative query pwd=', 'GET /cb?pwd=QLCNRYpwdq&x=1', ['QLCNRYpwdq']],
 ['JSON "pwd"', '{"user":"sa","pwd":"QMCNRYjsonpwd"}', ['QMCNRYjsonpwd']],
 ['pwd/pass/credentials/auth keys', 'pwd=QNCNRYpwdkey pass=QNCNRYpasskey credentials: QNCNRYcredvalue auth=QNCNRYauthvalue', ['QNCNRY']],
 ['PuTTY key file', 'PuTTY-User-Key-File-3: ssh-rsa\nPrivate-Lines: 14\nAAAAQOCNRYputty', ['AAAAQOCNRYputty']],
 ['Stripe whsec_', 'webhook signing whsec_QPCNRYabcdefghijklmnopqrstuvwxyz012', ['whsec_QPCNRY']],
 ['GitHub ghs_ short', 'token ghs_QQCNRYabcdefghijklmnop', ['ghs_QQCNRY']],
 ['Google API key', 'maps failed synthetic-example-AIzaQRCNRYabcdefghijklmnopqrstuvwxyz0123456', ['AIzaQRCNRY']],
 ['npm token', 'publish failed npm_QSCNRYabcdefghijklmnopqrstuvwxyz012345', ['npm_QSCNRY']],
 // Digit runs that are numbers (cards) are still scrubbed, whole and in groups.
 ['card number, spaced and hyphenated', 'charge declined for 4242 4242 4242 4242 and 5555-5555-5555-4444 and 4000056655665556', ['4242 4242', '5555-5555', '4000056655665556']],
 ['AWS key after underscore, ASIA key', 'key_' + aws + 'QX7QTCNRY4ZZ2WJP ' + awsSession + 'QX7QTCNRY4ZZ2WJQ expired', [aws + 'QX7QTCNRY4ZZ2WJP', awsSession + 'QX7QTCNRY4ZZ2WJQ']],
];
// Ordinary text that must reach every path unchanged.
export const ordinary = [
 ['tokenizer/passwordless/secretary', 'the tokenizer, passwordless sign-in and secretary all work'],
 ['Bearer of bad news', 'Bearer of bad news: the build broke'],
 ['Session: expired', 'Session: expired, please sign in again'],
 ['tokens count', 'tokens: 4096 of 8192 used'],
 ['tokenCount', 'tokenCount: 4096'],
 ['URL without credentials', 'Failed to fetch https://api.example.com/v2/items/7'],
 // Identifiers whose groups happen to be all digits are not numbers (spool-scrubfix, 19 Oct).
 ['UUID, last group all digits', 'receipt 8f3a1c2e-5b7d-4e9a-8123-158309874643 not found'],
 ['UUID, every group digits', 'receipt rcpt_12345678-1234-4123-8123-123456789012 and urn:uuid:12345678-5b7d-4e9a-b2c3-158309874643'],
 ['UUID, upper case, digit middle', 'order 8F3A1C2E-5B7D-4E9A-8123-158309874643 shipped; x 12345678-1234-4123-8123-ABCDEFABCDEF y'],
 ['trace, span, ULID and hex ids', 'traceparent 00-4bf92f3577b34da6a3ce929d0e0e4736-1234567890123456-01 trace 4bf92f3577b34da6a3ce929d0e0e4736 span 00f067aa0ba902b7 ulid 01ARZ3NDEKTSV4RRFFQ69G5FAV'],
 ['stack trace', "TypeError: Cannot read properties of undefined (reading 'token')\n    at refreshSession (/app/src/session.js:42:13)\n    at async Router.handle (/app/node_modules/express/lib/router.js:284:7)"],
];
