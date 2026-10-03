import React, { useEffect, useRef, useState } from "react";
import { Image, View, Text, Platform, Alert, ScrollView } from "react-native";
import * as Picker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { api } from "./api";
import { Body, Button, ErrorText, Label, Panel, Toggle, C } from "./ui";

export type Photo = { id: string; slot: number };
export type Media = { photos: Photo[]; status: string; revision: string; reason: string };

export function PrivatePhoto({ id }: { id: string }) { return <PhotoImage key={id} id={id} />; }
function PhotoImage({ id }: { id: string }) {
  const [uri, setUri] = useState("");
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    api<{ base64: string }>("/photos/" + id).then(r => {
      if (alive) setUri("data:image/jpeg;base64," + r.base64);
    }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [id, retry]);
  return <View style={{ height: 190, minWidth: 130, borderRadius: 16, overflow: "hidden", backgroundColor: C.sage, justifyContent: "center" }}>
    {uri ? <Image accessibilityLabel="Profile photo" source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" /> :
      error ? <Button title="Retry photo" secondary onPress={() => { setError(false); setRetry(retry + 1); }} /> : <Body muted>Loading photo…</Body>}
  </View>;
}
export function PhotoGallery({ photos }: { photos?: Photo[] }) {
  if (!photos?.length) return null;
  return <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 12 }}>
    {photos.map(p => <View key={p.id} style={{ width: 230 }}><PrivatePhoto id={p.id} /></View>)}
  </ScrollView>;
}
const statusLabels: Record<string, string> = {
  unverified: "Not verified", pending: "Awaiting manual review", verified: "Photos reviewed",
  rejected: "New selfie or photos needed", expired: "Review expired",
};
async function selectPhoto(camera: boolean) {
  if (camera) {
    if (Platform.OS === "web") throw new Error("Take your verification selfie in the Android app.");
    const permission = await Picker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error("Allow camera access in your phone settings to take a selfie.");
  }
  const options: Picker.ImagePickerOptions = {
    mediaTypes: ["images"], allowsEditing: !camera, quality: 0.85,
    ...(camera ? { cameraType: Picker.CameraType.front } : { aspect: [3, 4] as [number, number] }),
  };
  const result = camera ? await Picker.launchCameraAsync(options) : await Picker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  context.resize(asset.width >= asset.height ? { width: Math.min(asset.width, 1000), height: null } : { height: Math.min(asset.height, 1000), width: null });
  const rendered = await context.renderAsync();
  try {
    const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
    if (!image.base64 || image.base64.length > 2000000) throw new Error("Choose a smaller photo.");
    return image.base64;
  } finally { rendered.release(); context.release(); }
}
export function PhotosPanel({ refresh }: { refresh: () => Promise<void> }) {
  const [media, setMedia] = useState<Media | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  async function load() {
    try { setMedia(await api("/me/photos")); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load photos."); }
  }
  useEffect(() => {
    let active = true;
    api<Media>("/me/photos").then(value => { if (active) setMedia(value); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  async function action(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await fn(); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Please retry."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function upload(slot: number) {
    await action(async () => {
      const base64 = await selectPhoto(false);
      if (base64) setMedia(await api("/me/photos/" + slot, "PUT", { base64 }));
    });
  }
  function remove(slot: number) {
    Alert.alert("Remove photo?", "Changing a photo removes your review badge until your new photos are reviewed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void action(async () => setMedia(await api("/me/photos/" + slot, "DELETE"))) },
    ]);
  }
  return <Panel>
    <Label>Your three photos</Label>
    <Body>Add clear, recent photos of yourself. Photo 1 is your main photo. All three become visible to eligible matches after manual review.</Body>
    <ErrorText message={error} />
    {!media ? <Button title="Load photos" onPress={() => void load()} /> : <>
      {[1, 2, 3].map(slot => {
        const p = media.photos.find(x => x.slot === slot);
        return <View key={slot} style={{ gap: 8 }}>
          <Label>{slot === 1 ? "1 · Main photo" : slot + " · More of you"}</Label>
          {p && <PrivatePhoto id={p.id} />}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Button title={p ? "Replace photo" : "Add photo"} secondary disabled={busy} onPress={() => void upload(slot)} /></View>
            {p && <Button title="Remove" secondary disabled={busy} onPress={() => remove(slot)} />}
          </View>
        </View>;
      })}
      <Label>Photo verification · {statusLabels[media.status] || media.status}</Label>
      {!!media.reason && <Body>{media.reason}</Body>}
      <Body muted>Your private camera selfie is compared with all three photos by a human reviewer. This is not automated liveness, age or identity verification. Your selfie is never shown to matches.</Body>
      {media.status !== "pending" && media.status !== "verified" && <>
        <Toggle label="I agree to private manual selfie review. My selfie is deleted after a decision or withdrawal; pending reviews expire after 7 days. Backups follow the privacy notice." value={consent} onChange={setConsent} />
        <Button title={busy ? "Please wait…" : "Take verification selfie"} disabled={busy || !consent || media.photos.length !== 3} onPress={() => void action(async () => {
          const base64 = await selectPhoto(true);
          if (base64) { setMedia(await api("/me/photo-verification", "POST", { base64, consent: true, revision: media.revision })); setConsent(false); }
        })} />
      </>}
      <Button title="Refresh review status" secondary disabled={busy} onPress={() => void load()} />
      {["pending", "verified"].includes(media.status) && <Button title="Withdraw photo verification" secondary disabled={busy} onPress={() => void action(async () => setMedia(await api("/me/photo-verification", "DELETE")))} />}
      <Text style={{ color: C.muted, fontSize: 12 }}>Replacing or removing any photo resets verification. Do not upload someone else&apos;s photos.</Text>
    </>}
  </Panel>;
}
