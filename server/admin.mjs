// Local operator console. Requires the same DATA_KEY and DB_PATH as the server.
import { Store } from "./src/store.mjs";
const store = new Store(
  process.env.DB_PATH || "data/raabta.db",
  process.env.DATA_KEY,
);
const [command, id] = process.argv.slice(2);
try {
  if (command === "reports") {
    for (const r of store.all(
      "SELECT * FROM reports WHERE resolved=0 ORDER BY created",
    ))
      console.log(
        JSON.stringify({
          id: r.id,
          reporter: r.reporter,
          target: r.target,
          reason: store.open(r.body),
          created: r.created,
        }),
      );
    for (const r of store.all("SELECT r.*,t.body FROM ai_reports r JOIN turns t ON t.id=r.turn_id WHERE r.resolved=0 ORDER BY r.created"))
      console.log(JSON.stringify({ id:r.id, type:"ai_reply", reporter:r.user_id, reason:store.open(r.reason), reply:store.open(r.body), created:r.created }));
  } else if (command === "resolve-ai") {
    if (!id || !store.get("SELECT 1 FROM ai_reports WHERE id=?", id)) throw new Error("Provide an AI report ID.");
    store.run("UPDATE ai_reports SET resolved=1 WHERE id=?", id);
    console.log("AI report marked reviewed.");
  } else if (command === "suspend") {
    if (!id || !store.user(id)) throw new Error("Provide a valid user ID.");
    store.transaction(() => {
      store.run("UPDATE users SET suspended=1,approved=0 WHERE id=?", id);
      store.run("DELETE FROM sessions WHERE user_id=?", id);
      store.run("UPDATE intros SET closed=1 WHERE a=? OR b=?", id, id);
    });
    console.log("Account suspended and sessions revoked.");
  } else if (command === "resolve") {
    if (!id || !store.get("SELECT 1 FROM reports WHERE id=?", id))
      throw new Error("Provide a valid report ID.");
    store.run("UPDATE reports SET resolved=1 WHERE id=?", id);
    console.log("Report marked reviewed.");
  } else
    console.log(
      "Usage: node --env-file=.env admin.mjs reports | suspend USER_ID | resolve REPORT_ID",
    );
} finally {
  store.close();
}
