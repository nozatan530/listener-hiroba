// リスナー広場：新しいテーマ・コメントをメールで知らせる（Google Apps Script）
// 毎日 7時・12時・17時・21時ごろに Firebase を確認し、前回から増えた未確認の投稿があればメールする。
// 使い方：このファイルと appsscript.json を Apps Script に貼り、setup を1回だけ実行する。

const DB_URL = 'https://listener-board-default-rtdb.asia-southeast1.firebasedatabase.app';
const TO = ''; // ← 通知を受け取るメールアドレスを書く（空欄なら、このスクリプトを動かしているアカウントに届く）
const ADMIN_URL = 'https://nozatan530.github.io/listener-hiroba/#admin';
const HOURS = [7, 12, 17, 21];

// 最初に1回だけ実行：確認のタイマーを作り直す
function setup() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  HOURS.forEach(h => ScriptApp.newTrigger('checkNewPosts').timeBased()
    .atHour(h).nearMinute(0).everyDays(1).inTimezone('Asia/Tokyo').create());
  PropertiesService.getScriptProperties().setProperty('lastChecked', String(Date.now()));
  readAll_(); // ここで読めないときは、この時点でエラーになる
}

// タイマーから呼ばれる本体
function checkNewPosts() {
  const props = PropertiesService.getScriptProperties();
  const last = Number(props.getProperty('lastChecked') || 0);
  const now = Date.now();
  const posts = readAll_();
  const fresh = posts.filter(p => p.at > last && p.at <= now);
  const waiting = posts.filter(p => !p.status).length;
  if (fresh.length) {
    const lines = fresh.sort((a, b) => a.at - b.at).map(p =>
      `■ ${p.label}（${p.name ? p.name + ' さん' : 'ペンネームなし'}／${Utilities.formatDate(new Date(p.at), 'Asia/Tokyo', 'M/d H:mm')}）\n${p.text}`);
    MailApp.sendEmail({
      to: TO || Session.getEffectiveUser().getEmail(),
      subject: `【リスナー広場】新しい投稿が${fresh.length}件届きました`,
      body: lines.join('\n\n') + `\n\n未確認は全部で${waiting}件です。管理画面で確認できます：\n${ADMIN_URL}\n`
    });
  }
  props.setProperty('lastChecked', String(now));
}

// テーマとコメントをまとめて読む（プロジェクトのオーナー権限で読むので、ルールに関係なく読める）
function readAll_() {
  const token = ScriptApp.getOAuthToken();
  const out = [];
  [['wishes', 'テーマ'], ['comments', 'コメント']].forEach(([col, label]) => {
    const res = UrlFetchApp.fetch(`${DB_URL}/${col}.json?access_token=${token}`, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error(`${col} を読めませんでした（${res.getResponseCode()}）：${res.getContentText()}`);
    Object.values(JSON.parse(res.getContentText()) || {}).forEach(p => { if (p) out.push(Object.assign({ label }, p)); });
  });
  return out;
}
