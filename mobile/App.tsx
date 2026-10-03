import React, {
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
} from "react";
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  api,
  ApiError,
  configured,
  requestId,
  restoreToken,
  saveToken,
} from "./src/api";
import {
  Card,
  Comparison,
  INTERESTS,
  Intro,
  Match,
  Message,
  Person,
  Profile,
  STYLES,
  User,
  VALUES,
} from "./src/types";
import { SecurityPanel } from "./src/SecurityPanel";
import { PhotosPanel, PhotoGallery } from "./src/Photos";
import { Recovery } from "./src/Recovery";
import { blankProfile, ProfileForm } from "./src/ProfileForm";
import {
  Body,
  Button,
  C,
  Chips,
  ErrorText,
  Field,
  Label,
  Mark,
  Panel,
  s,
  Title,
  Toggle,
} from "./src/ui";

import {
  router,
  Redirect,
  Slot,
  usePathname,
  useLocalSearchParams,
} from "expo-router";

const photosEnabled = process.env.EXPO_PUBLIC_PROFILE_PHOTOS_ENABLED === "true";
const temporaryPilot = process.env.EXPO_PUBLIC_TEMPORARY_PILOT === "true";

type Tab = "Today" | "Talk" | "Connect" | "You";
type Action = (fn: () => Promise<void>) => Promise<void>;
function Page({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.content}
    >
      {children}
    </ScrollView>
  );
}
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={s.screen}>
      <StatusBar style="dark" />
      {temporaryPilot && <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.sage }}><Text style={s.caption}>Test version · Accounts and chats may reset. Photos are unavailable.</Text></View>}
      {children}
    </SafeAreaView>
  );
}
function ProgressDots({ n }: { n: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 7 }}>
      {Array.from({ length: 7 }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 7,
            borderRadius: 7,
            backgroundColor: i < n ? C.green : "#D9DFD1",
          }}
        />
      ))}
    </View>
  );
}

type State = {
  user: User | null;
  loading: boolean;
  error: string;
  busy: boolean;
  act: Action;
  refresh: () => Promise<void>;
  login: (r: { token: string; user: User }) => Promise<void>;
  logout: () => void;
  clearError: () => void;
};
const Context = createContext<State | null>(null);
export function useApp() {
  const state = useContext(Context);
  if (!state) throw new Error("Missing app provider");
  return state;
}
export default function AppProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    setUser(await api<User>("/me"));
  }
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (await restoreToken()) {
          const u = await api<User>("/me");
          if (alive) setUser(u);
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) await saveToken("");
        else if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  const act: Action = async (fn) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && user) {
        await saveToken("");
        setUser(null);
      }
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const login = async (r: { token: string; user: User }) => {
    await saveToken(r.token);
    setUser(r.user);
  };
  return (
    <SafeAreaProvider>
      <Context.Provider
        value={{
          user,
          loading,
          error,
          busy,
          act,
          refresh,
          login,
          logout: () => {
            setUser(null);
            setError("");
          },
          clearError: () => setError(""),
        }}
      >
        {children}
      </Context.Provider>
    </SafeAreaProvider>
  );
}
export function AuthRoute() {
  const { user, loading, busy, error, act, login } = useApp();
  if (loading)
    return (
      <Shell>
        <ActivityIndicator color={C.orange} />
      </Shell>
    );
  if (user) return <Redirect href="/today" />;
  return (
    <Shell>
      <Auth busy={busy} error={error} act={act} onLogin={login} />
    </Shell>
  );
}
export function MainLayout() {
  const { user, loading, error, clearError } = useApp(),
    path = usePathname();
  if (loading)
    return (
      <Shell>
        <ActivityIndicator color={C.orange} />
      </Shell>
    );
  if (!user) return <Redirect href="/" />;
  const tab =
    path === "/conversation"
      ? "Connect"
      : path.slice(1).replace(/^./, (c) => c.toUpperCase());
  return (
    <Shell>
      <View
        style={[
          s.row,
          {
            justifyContent: "space-between",
            paddingHorizontal: 24,
            paddingTop: 8,
            paddingBottom: 12,
          },
        ]}
      >
        <View style={s.row}>
          <Mark small />
          <Text style={{ fontFamily: "serif", fontSize: 27, color: C.ink }}>
            raabta
          </Text>
        </View>
        <Text style={{ fontSize: 10, letterSpacing: 1.7, color: C.green }}>
          A LITTLE MORE REAL
        </Text>
      </View>
      {!!error && (
        <View style={{ paddingHorizontal: 24, paddingBottom: 10 }}>
          <ErrorText message={error} />
        </View>
      )}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Slot />
      </KeyboardAvoidingView>
      <View style={s.nav}>
        {(["Today", "Talk", "Connect", "You"] as Tab[]).map((x, i) => (
          <Pressable
            key={x}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === x }}
            onPress={() => {
              clearError();
              router.replace(("/" + x.toLowerCase()) as "/today");
            }}
            style={s.tab}
          >
            <Text
              style={{ fontSize: 21, color: tab === x ? C.orange : C.muted }}
            >
              {["◉", "◌", "∞", "○"][i]}
            </Text>
            <Text
              style={{
                fontSize: 11,
                fontWeight: tab === x ? "700" : "400",
                color: tab === x ? C.orange : C.muted,
              }}
            >
              {x}
            </Text>
          </Pressable>
        ))}
      </View>
    </Shell>
  );
}
export function TodayRoute() {
  const { user } = useApp();
  return user ? (
    <Home
      user={user}
      onTalk={() => router.replace("/talk")}
      onReview={() => router.replace("/you")}
    />
  ) : null;
}
export function TalkRoute() {
  const { user, busy, act, refresh } = useApp();
  return user ? (
    <Talk user={user} busy={busy} act={act} refresh={refresh} />
  ) : null;
}
export function ConnectRoute() {
  const { user, busy, act } = useApp();
  return user ? <Connect user={user} busy={busy} act={act} /> : null;
}
export function AccountRoute() {
  const { user, busy, act, refresh, logout } = useApp();
  return user ? (
    <Account
      user={user}
      busy={busy}
      act={act}
      refresh={refresh}
      onLogout={logout}
    />
  ) : null;
}
export function ConversationRoute() {
  const { user, busy, act } = useApp(),
    { id } = useLocalSearchParams<{ id: string }>();
  const [intro, setIntro] = useState<Intro | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api<{ intros: Intro[] }>("/intros")
      .then((r) => {
        if (!live) return;
        const item = r.intros.find((i) => i.id === id && i.connected);
        if (item) setIntro(item);
        else setError("This conversation is no longer available.");
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [id]);
  if (error)
    return (
      <Page>
        <ErrorText message={error} />
        <Button
          title="Back to introductions"
          onPress={() => router.replace("/connect")}
        />
      </Page>
    );
  if (!intro || !user) return <ActivityIndicator color={C.orange} />;
  return (
    <PartnerChat
      user={user}
      intro={intro}
      busy={busy}
      act={act}
      onBack={() => router.replace("/connect")}
      onReport={() =>
        router.replace({
          pathname: "/connect",
          params: { report: intro.person.id },
        })
      }
    />
  );
}
function Auth({
  busy,
  error,
  act,
  onLogin,
}: {
  busy: boolean;
  error: string;
  act: Action;
  onLogin: (r: { token: string; user: User }) => Promise<void>;
}) {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode =
    params.mode === "login"
      ? "login"
      : params.mode === "recovery"
        ? "recovery"
      : params.mode === "signup"
        ? "signup"
        : "welcome";
  const setMode = (value: string) => router.setParams({ mode: value });
  const [step, setStep] = useState(0),
    [handle, setHandle] = useState(""),
    [password, setPassword] = useState(""),
    [invite, setInvite] = useState(""),
    [profile, setProfile] = useState<Profile>(blankProfile),
    [adult, setAdult] = useState(false),
    [aiConsent, setAiConsent] = useState(false),
    [email, setEmail] = useState(""),
    [termsConsent, setTermsConsent] = useState(false),
    [config, setConfig] = useState<{inviteRequired:boolean;verificationRequired:boolean;privacyUrl:string;termsUrl:string} | null>(null);
  useEffect(() => { api("/config").then(setConfig).catch(() => {}); }, []);
  if (mode === "recovery") return <Page><Recovery busy={busy} act={act} onBack={() => setMode("login")} /><ErrorText message={error} /></Page>;
  if (mode === "welcome")
    return (
      <Page>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Text style={{ fontFamily: "serif", fontSize: 31, color: C.ink }}>
            raabta
          </Text>
          <Label>18+ · Serious connections</Label>
        </View>
        <View style={{ paddingVertical: 30, alignItems: "center" }}>
          <View
            style={{
              height: 228,
              width: 228,
              borderRadius: 120,
              backgroundColor: C.sage,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Mark />
            <Text
              style={{
                fontFamily: "serif",
                fontSize: 18,
                color: C.green,
                marginTop: 8,
              }}
            >
              a connection, understood.
            </Text>
          </View>
        </View>
        <Label>For something that lasts</Label>
        <Text style={[s.title, { fontSize: 44, lineHeight: 50 }]}>
          Be understood.{"\n"}Then meet someone.
        </Text>
        <Body muted>
          A few honest conversations with AI. A clearer picture of you. An
          introduction with intention.
        </Body>
        <View
          style={[
            s.row,
            { justifyContent: "space-between", paddingVertical: 12 },
          ]}
        >
          {["01  Talk", "02  Reflect", "03  Connect"].map((x) => (
            <Text
              key={x}
              style={{ fontSize: 13, color: C.green, fontWeight: "600" }}
            >
              {x}
            </Text>
          ))}
        </View>
        <Button title="Begin your story" onPress={() => setMode("signup")} />
        <Button
          title="I already have an account"
          secondary
          onPress={() => setMode("login")}
        />
        <ErrorText message={error} />
        <Text style={[s.caption, { textAlign: "center" }]}>
          Real people. Mutual choices. No promises of a perfect match.
        </Text>
        {!configured && (
          <Panel>
            <Label>Development build</Label>
            <Body muted>
              Your backend address has not been configured yet. The setup guide
              in the source package explains how to connect it.
            </Body>
          </Panel>
        )}
      </Page>
    );
  return (
    <Page>
      <Button
        title="← Back"
        secondary
        onPress={() =>
          step > 0 && mode === "signup" ? setStep(step - 1) : setMode("welcome")
        }
      />
      <Label>
        {mode === "login" ? "Welcome back" : `Your story · ${step + 1} of 3`}
      </Label>
      <Title>
        {mode === "login"
          ? "A little more you."
          : step === 0
            ? "Start with the basics."
            : step === 1
              ? "What are you looking for?"
              : "Your story stays yours."}
      </Title>
      {mode === "login" || step === 0 ? (
        <>
          <Field
            label="Username"
            placeholder="Your private login name"
            value={handle}
            onChangeText={setHandle}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Field
            label="Password"
            placeholder="At least 12 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          {mode === "signup" && <Field label="Recovery email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} />}
          {mode === "signup" && config?.inviteRequired !== false && (
            <Field
              label="Pilot invitation code"
              value={invite}
              onChangeText={setInvite}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
        </>
      ) : null}
      {mode === "signup" && step === 1 && (
        <ProfileForm value={profile} onChange={setProfile} />
      )}
      {mode === "signup" && step === 2 && (
        <>
          <Panel tint>
            <Body>
              Your conversations are processed by our AI provider and stored
              encrypted on our server. This is not end-to-end encryption. The
              operator can access records for support and safety.
            </Body>
            <Body>
              Only a profile you review and approve is used for matching. We do
              not show your private AI conversation to another member.
            </Body>
            <Body>
              You can pause matching, erase AI history, or delete your account
              in You.
            </Body>
          </Panel>
          {!!config?.privacyUrl && <Button secondary title="Read privacy notice" onPress={() => act(async () => { await Linking.openURL(config.privacyUrl); })} />}
          {!!config?.termsUrl && <Button secondary title="Read terms & community rules" onPress={() => act(async () => { await Linking.openURL(config.termsUrl); })} />}
          <Body>Shared profiles and partner messages are also checked by OpenAI for safety before delivery. Reports are reviewed by the operator.</Body>
          <Toggle label="I accept the terms, privacy notice and community rules." value={termsConsent} onChange={setTermsConsent} />
          <Toggle
            label="I am 18 or older and want a serious relationship."
            value={adult}
            onChange={setAdult}
          />
          <Toggle
            label="I agree to AI processing of my conversations to help me reflect and create a draft profile."
            value={aiConsent}
            onChange={setAiConsent}
          />
          <Body muted>
            Raabta is an AI reflection and introduction service, not therapy or
            an emergency service. Never send passwords, payment details or
            sensitive identity documents.
          </Body>
        </>
      )}
      <ErrorText message={error} />
      {mode === "login" ? (
        <>
          <Button
            busy={busy}
            title="Sign in"
            onPress={() =>
              act(async () =>
                onLogin(await api("/auth/login", "POST", { handle, password })),
              )
            }
          />
          <Button secondary title="Forgot your password?" onPress={() => setMode("recovery")} />
        </>
      ) : step < 2 ? (
        <Button
          title="Continue →"
          disabled={
            step === 0 &&
            (!handle.trim() || password.length < 12 || !email.trim() || (config?.inviteRequired !== false && !invite.trim()))
          }
          onPress={() => setStep(step + 1)}
        />
      ) : (
        <Button
          busy={busy}
          disabled={!adult || !aiConsent || !termsConsent}
          title="Let's begin"
          onPress={() =>
            act(async () =>
              onLogin(
                await api("/auth/register", "POST", {
                  handle,
                  password,
                  inviteCode: invite,
                  email,
                  termsConsent,
                  profile,
                  adultConsent: adult,
                  aiConsent,
                }),
              ),
            )
          }
        />
      )}
    </Page>
  );
}
function Home({
  user,
  onTalk,
  onReview,
}: {
  user: User;
  onTalk: () => void;
  onReview: () => void;
}) {
  const n = Math.min(user.progress.completed, 7);
  return (
    <Page>
      {user.verificationRequired && !user.emailVerified && <Panel tint><Label>One step before we begin</Label><Body>Verify your email in You to protect your account and start your AI conversations.</Body><Button title="Verify my email" onPress={onReview} /></Panel>}
      <Label>YOUR SPACE, {user.profile.name.toUpperCase()}</Label>
      <Title>Good things take{"\n"}a little knowing.</Title>
      <Body muted>
        You don't need the perfect answer. Just start with what's on your mind.
      </Body>
      <Panel tint>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Label>Your getting-to-know-you days</Label>
          <Text
            style={{
              color: C.green,
              fontWeight: "600",
              minWidth: 45,
              textAlign: "right",
            }}
          >
            {n} / 7
          </Text>
        </View>
        <ProgressDots n={n} />
        <Body>
          {user.progress.ready
            ? "You’ve made room for reflection. Now decide what feels true enough to share."
            : "A few conversations. A clearer sense of what matters."}
        </Body>
        <Text style={s.caption}>
          A day counts after two substantial messages (at least 40 characters
          each, 120 in total). Days use India time. Seven days is a pilot rule,
          not a scientific compatibility measure.
        </Text>
      </Panel>
      <Panel>
        <Label>A thought for today</Label>
        <Text style={[s.title, { fontSize: 27, lineHeight: 34 }]}>
          {[
            "When do you feel most like yourself?",
            "What does a good ordinary day together look like?",
            "Which values would you never compromise?",
            "How do you like to work through disagreements?",
            "What makes you feel respected and safe?",
            "What do you hope to build over the next few years?",
            "What should a future partner understand about you?",
          ][Math.min(n, 6)]}
        </Text>
        <Body muted>
          Tell your AI guide a little about the people, places or small moments
          that bring out the real you.
        </Body>
        <Button title="Let's talk →" onPress={onTalk} />
      </Panel>
      {user.progress.ready && (
        <Button
          secondary
          title={
            user.approved
              ? "Review your shared profile"
              : "Review your match profile"
          }
          onPress={onReview}
        />
      )}
      <View style={s.row}>
        <Mark small />
        <Text style={[s.caption, { flex: 1 }]}>
          You choose what to share. Every introduction needs two yeses.
        </Text>
      </View>
    </Page>
  );
}
function Talk({
  user,
  busy,
  act,
  refresh,
}: {
  user: User;
  busy: boolean;
  act: Action;
  refresh: () => Promise<void>;
}) {
  const [messages, setMessages] = useState<Message[]>([]),
    [input, setInput] = useState(""),
    [loading, setLoading] = useState(true),
    [err, setErr] = useState(""),
    [hasMore, setHasMore] = useState(false),
    [reportId, setReportId] = useState<number | null>(null),
    [reportReason, setReportReason] = useState(""),
    [reportNotice, setReportNotice] = useState("");
  const scroll = useRef<ScrollView>(null),
    pending = useRef<{ message: string; requestId: string } | null>(null);
  async function load() {
    try {
      const r = await api<{ messages: Message[]; hasMore: boolean }>("/ai/history");
      setMessages(r.messages); setHasMore(r.hasMore);
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function send() {
    const message = input.trim();
    if (!message) return;
    const req =
      pending.current?.message === message
        ? pending.current
        : { message, requestId: requestId() };
    pending.current = req;
    await api("/ai/chat", "POST", req);
    setInput("");
    pending.current = null;
    await load();
    await refresh();
  }
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 8, gap: 8 }}>
        <Label>YOUR AI REFLECTION GUIDE</Label>
        <Text style={s.caption}>
          Private from other members • You can erase this history
        </Text>
      </View>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() =>
          scroll.current?.scrollToEnd({ animated: true })
        }
        contentContainerStyle={[s.content, { gap: 14, paddingTop: 22 }]}
      >
        {loading && <ActivityIndicator color={C.orange} />}
        <ErrorText message={err} />
        {err && <Button title="Retry" secondary onPress={load} />}
        {!messages.length && !loading && (
          <>
            <View style={{ alignItems: "center" }}>
              <Mark />
            </View>
            <Title>
              Hey {user.profile.name}.{"\n"}Where shall we start?
            </Title>
            <Body muted>
              I'm Raabta, your AI guide. What's one small thing that made you
              feel good recently?
            </Body>
            <View style={{ gap: 8 }}>
              {[
                "What I want from a relationship",
                "A little about my everyday life",
                "Something I find difficult to talk about",
              ].map((x) => (
                <Button
                  key={x}
                  title={x}
                  secondary
                  onPress={() => setInput(x)}
                />
              ))}
            </View>
          </>
        )}
        {hasMore && <Button secondary busy={busy} title="Load earlier conversations" onPress={() => act(async () => {
          const r = await api<{messages:Message[];hasMore:boolean}>(`/ai/history?before=${messages[0].id}`);
          setMessages(prev => [...r.messages, ...prev]); setHasMore(r.hasMore);
        })} />}
        {!!reportNotice && <Body>{reportNotice}</Body>}
        {reportId !== null && <Panel><Label>Report an AI reply</Label><Field label="What went wrong?" value={reportReason} onChangeText={setReportReason} multiline maxLength={2000} />
          <Button busy={busy} disabled={reportReason.trim().length < 10} title="Send feedback for review" onPress={() => act(async () => {
            await api('/ai/reports','POST',{messageId:reportId,reason:reportReason}); setReportId(null); setReportReason(''); setReportNotice('Report received. The operator can review this reply and your reason.');
          })} /><Button secondary title="Cancel report" onPress={() => setReportId(null)} /></Panel>}
        {messages.map((m) => (
          <View key={m.id} style={[s.bubble, m.role === "user" && s.self]}>
            <Label>{m.role === "user" ? "You" : "Raabta · AI"}</Label>
            <Text style={[s.body, { marginTop: 6 }]}>{m.text}</Text>
            {m.role === 'assistant' && <Pressable accessibilityRole="button" onPress={() => {setReportId(m.id); setReportNotice('');}}><Text style={s.caption}>Report this AI reply</Text></Pressable>}
          </View>
        ))}
        {busy && <Text style={s.caption}>Raabta is reflecting…</Text>}
      </ScrollView>
      <View
        style={{
          padding: 16,
          paddingTop: 8,
          gap: 10,
          borderTopWidth: 1,
          borderColor: C.line,
          backgroundColor: C.bg,
        }}
      >
        {!user.aiConsent ? (
          <Body muted>
            AI processing is paused. Enable it in You to continue.
          </Body>
        ) : !user.aiConfigured ? (
          <Body muted>
            Live AI is not connected. The operator needs to configure the
            backend API key and model.
          </Body>
        ) : null}
        <Field
          label="Your message"
          placeholder="Just be yourself…"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
          style={{ minHeight: 58, maxHeight: 120 }}
        />
        <Button
          title="Send message →"
          disabled={!input.trim() || !user.aiConsent || !user.aiConfigured || (user.verificationRequired && !user.emailVerified)}
          busy={busy}
          onPress={() => act(send)}
        />
      </View>
    </View>
  );
}
function PersonCard({
  person,
  comparison,
  children,
}: {
  person: Person;
  comparison?: Comparison | null;
  children?: React.ReactNode;
}) {
  return (
    <Panel>
      <View style={s.row}>
        <View style={s.avatar}>
          <Text style={{ fontFamily: "serif", fontSize: 27, color: C.orange }}>
            {person.name.slice(0, 1)}
          </Text>
        </View>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 22, color: C.ink, fontFamily: "serif" }}>
            {person.name}, {person.age}
          </Text>
          <Text style={s.caption}>{person.city} · Serious relationship</Text>
        </View>
      </View>
      <PhotoGallery photos={person.photos} />
      {person.photoVerified && <Body>✓ Photos manually reviewed</Body>}
      {!!person.heightCm && <Body>{person.heightCm} cm · {Math.floor(Math.round(person.heightCm / 2.54) / 12)}′ {Math.round(person.heightCm / 2.54) % 12}″</Body>}
      {!!person.bio && <Body>{person.bio}</Body>}
      {!!person.occupation && <Body>Work: {person.occupation}</Body>}
      {!!person.education && <Body>Education: {person.education}</Body>}
      {!!person.languages && <Body>Languages: {person.languages}</Body>}
      {!!person.relationshipStatus && person.relationshipStatus !== "Prefer not to say" && <Body>{person.relationshipStatus}</Body>}
      {!!person.drinking && person.drinking !== "Prefer not to say" && <Body>Drinks: {person.drinking}</Body>}
      <Body>
        {person.card?.about || "This person is updating their profile."}
      </Body>
      <View style={s.wrap}>
        {person.card?.values.map((v) => (
          <Text
            key={v}
            style={{
              backgroundColor: C.sage,
              color: C.green,
              padding: 8,
              borderRadius: 9,
              fontSize: 12,
            }}
          >
            {v}
          </Text>
        ))}
      </View>
      {comparison && (
        <>
          <View style={s.rule} />
          <Label>Why an introduction may make sense</Label>
          {comparison.reasons.map((r) => (
            <Body key={r}>↳ {r}</Body>
          ))}
          {comparison.discuss.map((r) => (
            <Text key={r} style={s.caption}>
              Something to discuss: {r}
            </Text>
          ))}
        </>
      )}
      <Text style={s.caption}>
        {person.children} · Smokes: {person.smoking}
      </Text>
      {children}
    </Panel>
  );
}
function Connect({
  user,
  busy,
  act,
}: {
  user: User;
  busy: boolean;
  act: Action;
}) {
  const [matches, setMatches] = useState<Match[]>([]),
    [intros, setIntros] = useState<Intro[]>([]),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [report, setReport] = useState<Person | null>(null),
    [reportText, setReportText] = useState("");
  const params = useLocalSearchParams<{ report?: string }>();
  useEffect(() => {
    if (!params.report) return;
    const person = intros.find((i) => i.person.id === params.report)?.person;
    if (person) {
      setReport(person);
      router.setParams({ report: "" });
    }
  }, [params.report, intros]);
  async function load() {
    try {
      const [m, i] = await Promise.all([
        api<{ people: Match[]; reason: string }>("/matches"),
        api<{ intros: Intro[] }>("/intros"),
      ]);
      setMatches(m.people);
      setReason(m.reason);
      setIntros(i.intros);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);
  const mutate = (path: string, body: unknown = {}) =>
    act(async () => {
      await api(path, "POST", body);
      await load();
    });
  return (
    <Page>
      <Label>Less scrolling. More intention.</Label>
      <Title>Room for a{"\n"}real connection.</Title>
      <Body muted>
        Your approved preferences guide these introductions. Take your time;
        compatibility is something you discover together.
      </Body>
      <ErrorText message={error} />
      {!loaded && <ActivityIndicator color={C.orange} />}
      <Button title="Refresh introductions" secondary onPress={load} />
      {intros.map((i) => (
        <PersonCard key={i.id} person={i.person} comparison={i.comparison}>
          {i.connected ? (
            <Button
              title={i.unread > 0 ? `Open conversation · ${i.unread} unread` : "Open your conversation →"}
              onPress={() =>
                router.push({ pathname: "/conversation", params: { id: i.id } })
              }
            />
          ) : i.acceptedByMe ? (
            <Body muted>You said yes. Waiting for their choice.</Body>
          ) : (
            <Button
              busy={busy}
              title="I'd like to meet them"
              onPress={() => mutate(`/intros/${i.id}/accept`)}
            />
          )}
          <Button
            title={
              i.connected ? "End this connection" : "Pass on this introduction"
            }
            secondary
            busy={busy}
            onPress={() => mutate(`/intros/${i.id}/decline`)}
          />
          <Button
            secondary
            title="Report or block"
            onPress={() => setReport(i.person)}
          />
        </PersonCard>
      ))}
      {matches.map((m) => (
        <PersonCard
          key={m.person.id}
          person={m.person}
          comparison={m.comparison}
        >
          <Button
            busy={busy}
            title="I'm open to an introduction"
            onPress={() => mutate("/intros", { target: m.person.id })}
          />
          <Button
            secondary
            title="Block / report this profile"
            onPress={() => setReport(m.person)}
          />
        </PersonCard>
      ))}
      {loaded && !matches.length && (
        <Panel tint>
          <Mark small />
          <Body>{reason || "No new introductions right now."}</Body>
          <Text style={s.caption}>
            Your AI never invents a person. This pilot needs compatible,
            opted-in members before it can introduce anyone.
          </Text>
        </Panel>
      )}
      {!!report && (
        <Panel>
          <Label>Safety · {report.name}</Label>
          <Body muted>
            Blocking immediately closes contact. Reports are reviewed by the
            pilot operator, not an emergency response team.
          </Body>
          <Field
            label="What happened?"
            value={reportText}
            onChangeText={setReportText}
            multiline
            maxLength={2000}
          />
          <Button
            busy={busy}
            disabled={reportText.trim().length < 10}
            title="Send report and block"
            onPress={() =>
              act(async () => {
                await api("/reports", "POST", {
                  target: report.id,
                  reason: reportText,
                });
                setReport(null);
                setReportText("");
                await load();
              })
            }
          />
          <Button
            busy={busy}
            secondary
            title="Block without a report"
            onPress={() =>
              act(async () => {
                await api("/blocks", "POST", { target: report.id });
                setReport(null);
                await load();
              })
            }
          />
          <Button secondary title="Cancel" onPress={() => setReport(null)} />
        </Panel>
      )}
    </Page>
  );
}
function PartnerChat({
  user,
  intro,
  busy,
  act,
  onBack,
  onReport,
}: {
  user: User;
  intro: Intro;
  busy: boolean;
  act: Action;
  onBack: () => void;
  onReport: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]),
    [input, setInput] = useState(""),
    [error, setError] = useState("");
  const latest = useRef(0),
    mounted = useRef(true),
    loading = useRef(false),
    pending = useRef<{ message: string; requestId: string } | null>(null);
  const scroll = useRef<ScrollView>(null);
  async function load() {
    if (loading.current) return;
    loading.current = true;
    try {
      const r = await api<{ messages: Message[] }>(
        `/intros/${intro.id}/messages?after=${latest.current}`,
      );
      if (mounted.current) {
        if (r.messages.length) {
          latest.current = r.messages[r.messages.length - 1].id;
          setMessages((prev) => [...prev, ...r.messages.filter(m => !prev.some(p => p.id === m.id))]);
          await api(`/intros/${intro.id}/read`, "POST", { lastId: latest.current });
        }
        setError("");
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      loading.current = false;
    }
  }
  useEffect(() => {
    mounted.current = true;
    load();
    const timer = setInterval(() => {
      if (AppState.currentState === "active") load();
    }, 5000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 24, gap: 12 }}>
        <Button secondary title="← Introductions" onPress={onBack} />
        <Text style={[s.title, { fontSize: 26 }]}>{intro.person.name}</Text>
        <Text style={s.caption}>
          Both of you chose this conversation. Be kind and respect boundaries.
        </Text>
        <ErrorText message={error} />
      </View>
      <ScrollView
        ref={scroll}
        onContentSizeChange={() =>
          scroll.current?.scrollToEnd({ animated: true })
        }
        contentContainerStyle={s.content}
      >
        {!messages.length && (
          <Panel tint>
            <Label>An easy place to start</Label>
            <Body>
              “What's something you've enjoyed making time for lately?”
            </Body>
          </Panel>
        )}
        {messages.map((m) => (
          <View key={m.id} style={[s.bubble, m.sender === user.id && s.self]}>
            <Body>{m.text}</Body>
            <Text style={s.caption}>
              {m.sender === user.id ? "You" : intro.person.name}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View style={{ padding: 16, gap: 8 }}>
        <Field
          label="Message"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
          style={{ minHeight: 54, maxHeight: 110 }}
        />
        <Button
          busy={busy}
          disabled={!input.trim() || !!error}
          title="Send"
          onPress={() =>
            act(async () => {
              const message = input.trim(),
                req =
                  pending.current?.message === message
                    ? pending.current
                    : { message, requestId: requestId() };
              pending.current = req;
              await api(`/intros/${intro.id}/messages`, "POST", req);
              pending.current = null;
              setInput("");
              await load();
            })
          }
        />
        <Button secondary title="Report / block" onPress={onReport} />
      </View>
    </View>
  );
}
function Account({
  user,
  busy,
  act,
  refresh,
  onLogout,
}: {
  user: User;
  busy: boolean;
  act: Action;
  refresh: () => Promise<void>;
  onLogout: () => void;
}) {
  const [card, setCard] = useState<Card>(
      user.card || { about: "", values: [], interests: [], communication: "" },
    ),
    [consent, setConsent] = useState(false),
    [editing, setEditing] = useState(false),
    [profile, setProfile] = useState(user.profile),
    [confirm, setConfirm] = useState<"history" | "delete" | null>(null),
    [password, setPassword] = useState(""),
    [modalError, setModalError] = useState("");
  return (
    <Page>
      <Label>Your story, your choices</Label>
      <Title>This is you.{"\n"}You get the final say.</Title>
      <Panel tint>
        <View style={s.row}>
          <View style={s.avatar}>
            <Text style={{ fontSize: 24, color: C.orange }}>
              {user.profile.name[0]}
            </Text>
          </View>
          <View>
            <Body>
              {user.profile.name} · {user.profile.city}
            </Body>
            <Text style={s.caption}>
              @{user.handle} ·{" "}
              {user.approved ? "Matching is on" : "Matching is paused"}
            </Text>
          </View>
        </View>
        <Toggle
          label="Allow AI processing of my conversations"
          value={user.aiConsent}
          onChange={(value) =>
            act(async () => {
              await api("/me/consent", "PUT", { aiConsent: value });
              await refresh();
            })
          }
        />
        <Text style={s.caption}>
          Revoking this stops new AI requests. Use “Erase AI history” below to
          remove stored conversations and memory.
        </Text>
      </Panel>
      {photosEnabled && <PhotosPanel refresh={refresh} />}
      <Button
        title={editing ? "Close preferences" : "Edit my preferences"}
        secondary
        onPress={() => setEditing(!editing)}
      />
      {editing && (
        <Panel>
          <ProfileForm value={profile} onChange={setProfile} />
          <Body muted>
            Saving pauses new matching and withdraws pending introductions.
            Existing accepted conversations remain open.
          </Body>
          <Button
            busy={busy}
            title="Save preferences"
            onPress={() =>
              act(async () => {
                await api("/me", "PUT", { profile });
                await refresh();
                setEditing(false);
                setConsent(false);
              })
            }
          />
        </Panel>
      )}
      <Panel>
        <Label>Your shareable match profile</Label>
        {!user.progress.ready ? (
          <>
            <Body>Keep getting to know yourself first.</Body>
            <ProgressDots n={user.progress.completed} />
            <Text style={s.caption}>
              {user.progress.completed} / 7 conversation days completed. Profile
              review opens after day 7.
            </Text>
          </>
        ) : (
          <>
            <Body muted>
              Review every word. This is what another member can see, along with
              your name, age, city, gender, children and smoking preferences.
            </Body>
            <Button
              secondary
              busy={busy}
              title="Suggest a draft from my conversations"
              disabled={!user.aiConsent || !user.aiConfigured}
              onPress={() =>
                act(async () => {
                  setCard(
                    (await api<{ card: Card }>("/profile/draft", "POST", {}))
                      .card,
                  );
                  setConsent(false);
                })
              }
            />
            <Field
              label="About me"
              placeholder="What should someone know about you?"
              value={card.about}
              multiline
              maxLength={600}
              onChangeText={(v) => {
                setCard({ ...card, about: v });
                setConsent(false);
              }}
            />
            <Label>What matters to me · choose 2–5</Label>
            <Chips
              options={VALUES}
              selected={card.values}
              multiple
              max={5}
              onChange={(v) => {
                setCard({ ...card, values: v });
                setConsent(false);
              }}
            />
            <Label>Things I enjoy · choose 2–6</Label>
            <Chips
              options={INTERESTS}
              selected={card.interests}
              multiple
              max={6}
              onChange={(v) => {
                setCard({ ...card, interests: v });
                setConsent(false);
              }}
            />
            <Label>When something is difficult, I prefer to</Label>
            <Chips
              options={STYLES}
              selected={[card.communication]}
              onChange={(v) => {
                setCard({ ...card, communication: v[0] });
                setConsent(false);
              }}
            />
            <Toggle
              label="I reviewed this profile and approve sharing it for matching."
              value={consent}
              onChange={setConsent}
            />
            <Button
              busy={busy}
              disabled={
                !consent ||
                card.about.trim().length < 20 ||
                card.values.length < 2 ||
                card.interests.length < 2 ||
                !card.communication
              }
              title="Approve profile & enable matching"
              onPress={() =>
                act(async () => {
                  await api("/profile/approve", "POST", { card, consent });
                  await refresh();
                  setConsent(false);
                })
              }
            />
          </>
        )}
        {user.approved && (
          <Button
            secondary
            busy={busy}
            title="Pause new matching"
            onPress={() =>
              act(async () => {
                await api("/profile/pause", "POST", {});
                await refresh();
              })
            }
          />
        )}
      </Panel>
      <SecurityPanel user={user} busy={busy} act={act} refresh={refresh} onLogout={onLogout} />
      <Panel>
        <Label>Privacy & safety</Label>
        <Body muted>
          Private AI chats and partner messages are stored encrypted on the
          server; they are not end-to-end encrypted. The pilot operator holds
          the decryption key. AI requests go to OpenAI; provider retention
          policies also apply.
        </Body>
        <Body muted>
          Never send money or identity documents to a match. Meet in a public
          place when you feel comfortable. Use Report / block from a connection
          if needed.
        </Body>
        <Button
          secondary
          title="Erase AI history & memory"
          onPress={() => {
            setModalError("");
            setConfirm("history");
          }}
        />
        <Button
          secondary
          title="Delete my account"
          onPress={() => {
            setModalError("");
            setConfirm("delete");
          }}
        />
      </Panel>
      <Button
        secondary
        busy={busy}
        title="Sign out"
        onPress={() =>
          act(async () => {
            try {
              await api("/auth/logout", "POST", {});
            } finally {
              await saveToken("");
              onLogout();
            }
          })
        }
      />
      <Text style={[s.caption, { textAlign: "center" }]}>
        Raabta 0.2 · Conversations first{"\n"}Built for deliberate, mutual
        introductions.
      </Text>
      <Modal
        visible={!!confirm}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirm(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#17231BCC",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Panel>
            <Title>
              {confirm === "history"
                ? "Start a fresh chapter?"
                : "Delete your account?"}
            </Title>
            <Body>
              {confirm === "history"
                ? "This erases your AI conversations, memory and match card. Your 7-day progress resets. Pending introductions close; accepted chats remain."
                : "This removes your account, AI history, profile, sessions and conversations from the active database. It cannot be undone. Existing encrypted backups, if operated, expire under the operator’s retention policy."}
            </Body>
            {confirm === "delete" && (
              <Field
                label="Confirm your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            )}
            <ErrorText message={modalError} />
            <Button
              danger
              busy={busy}
              title={
                confirm === "history"
                  ? "Erase AI history"
                  : "Permanently delete account"
              }
              onPress={() =>
                act(async () => {
                  setModalError("");
                  try {
                    if (confirm === "history") {
                      await api("/ai/history", "DELETE", {});
                      setCard({
                        about: "",
                        values: [],
                        interests: [],
                        communication: "",
                      });
                      await refresh();
                      setConfirm(null);
                    } else {
                      await api("/me", "DELETE", {
                        confirm: "DELETE",
                        password,
                      });
                      await saveToken("");
                      onLogout();
                    }
                  } catch (e) {
                    setModalError((e as Error).message);
                    throw e;
                  }
                })
              }
            />
            <Button
              secondary
              title="Keep my data"
              onPress={() => setConfirm(null)}
            />
          </Panel>
        </View>
      </Modal>
    </Page>
  );
}
