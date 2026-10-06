/* OphthalConf identity only; Google Calendar OAuth has its own consent and session. */
(function (root) {
  "use strict";
  const SDK_BASE = "https://www.gstatic.com/firebasejs/12.19.0/";
  async function loadSDK() {
    const [app, auth] = await Promise.all([
      import(SDK_BASE + "firebase-app.js"), import(SDK_BASE + "firebase-auth.js")
    ]);
    return {...app, ...auth};
  }
  function createController({config = {}, load = loadSDK, onChange = () => {}} = {}) {
    let sdk, auth, user = null, phase = "loading", message = "", busy = false, ready;
    const listeners = new Set();
    const snapshot = () => ({phase, busy, message, user: user ? {
      uid: user.uid, displayName: user.displayName || "", email: user.email || ""
    } : null});
    function notify() {onChange(snapshot()); listeners.forEach(fn => fn(snapshot()));}
    function fail(error) {
      const messages = {
        "auth/popup-closed-by-user": "ログインをキャンセルしました。",
        "auth/cancelled-popup-request": "ログインをキャンセルしました。",
        "auth/popup-blocked": "ポップアップを許可して、もう一度ログインしてください。",
        "auth/unauthorized-domain": "このサイトのドメインがFirebaseの認証設定に登録されていません。",
        "auth/network-request-failed": "通信に失敗しました。接続を確認して再試行してください。",
        "auth/operation-not-allowed": "FirebaseでGoogleログインを有効にしてください。",
        "auth/web-storage-unsupported": "ログイン状態の保存にはブラウザーのストレージを許可してください。"
      };
      message = messages[error?.code] || "ログイン処理に失敗しました。再試行してください。";
    }
    function init() {
      if (ready) return ready;
      ready = (async () => {
        const fields = ["apiKey", "authDomain", "projectId", "appId"];
        if (fields.some(key => typeof config[key] !== "string" || !config[key].trim() || config[key].includes("YOUR_"))) {
          phase = "unconfigured"; message = "Googleログインは準備中です。"; notify(); return;
        }
        try {
          sdk = await load();
          // A named app avoids interfering with other Firebase integrations in the future.
          const app = sdk.getApps().find(item => item.name === "ophthalconf-auth") || sdk.initializeApp(config, "ophthalconf-auth");
          auth = sdk.getAuth(app);
          await sdk.setPersistence(auth, sdk.browserLocalPersistence);
          await new Promise((resolve, reject) => {
            sdk.onAuthStateChanged(auth, current => {
              user = current; phase = "ready"; message = ""; notify(); resolve();
            }, error => {user = null; phase = "error"; fail(error); notify(); reject(error);});
          });
        } catch (error) {phase = "error"; fail(error); message += " ページを再読み込みしてください。"; notify();}
      })();
      return ready;
    }
    // No await before signInWithPopup: preserve the user's gesture on mobile browsers.
    async function login() {
      if (phase !== "ready" || busy || user) return;
      busy = true; message = ""; notify();
      try {
        const provider = new sdk.GoogleAuthProvider();
        provider.setCustomParameters({prompt: "select_account"});
        await sdk.signInWithPopup(auth, provider);
        // The observer is the source of truth. Do not retain Google OAuth credentials.
      } catch (error) {fail(error);} finally {busy = false; notify();}
    }
    async function logout() {
      if (phase !== "ready" || busy || !user) return;
      busy = true; message = ""; notify();
      try {await sdk.signOut(auth);} catch (error) {fail(error);} finally {busy = false; notify();}
    }
    return {init, login, logout, snapshot,
      getUid: () => user?.uid || null,
      // Obtain an ID token only when a future backend actually needs it; do not persist it yourself.
      getIdToken: (forceRefresh = false) => user ? user.getIdToken(forceRefresh) : Promise.reject(new Error("not-signed-in")),
      subscribe(fn) {listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn);}
    };
  }
  function mount(controller, document) {
    const login = document.getElementById("auth-login");
    if (!login) return;
    const logout = document.getElementById("auth-logout"), label = document.getElementById("auth-user"), status = document.getElementById("auth-status");
    controller.subscribe(state => {
      login.hidden = !!state.user; logout.hidden = !state.user; label.hidden = !state.user;
      login.disabled = state.phase !== "ready" || state.busy;
      logout.disabled = state.busy || state.phase !== "ready";
      login.textContent = state.busy ? "ログイン中…" : "Googleでログイン";
      logout.textContent = state.busy ? "ログアウト中…" : "ログアウト";
      const name = state.user?.displayName || state.user?.email || "ログイン済み";
      label.textContent = name; label.title = state.user?.email || name;
      status.textContent = state.phase === "loading" ? "ログイン状態を確認中…" : state.message;
      status.hidden = !status.textContent;
    });
    login.addEventListener("click", () => controller.login());
    logout.addEventListener("click", () => controller.logout());
    controller.init();
  }
  root.OphthalAuth = createController({config: typeof FIREBASE_CONFIG !== "undefined" ? FIREBASE_CONFIG : {}});
  if (root.document) mount(root.OphthalAuth, root.document);
  if (typeof module !== "undefined" && module.exports) module.exports = {createController, mount};
})(globalThis);
