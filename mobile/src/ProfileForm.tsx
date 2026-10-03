import React from "react";
import { View } from "react-native";
import { Profile, GENDERS, CHILDREN } from "./types";
import { Field, Label, Chips, Toggle, Body } from "./ui";
export const blankProfile: Profile = {
  name: "",
  dob: "",
  city: "",
  gender: "",
  seeking: [],
  minAge: 23,
  maxAge: 35,
  localOnly: true,
  children: "Undecided",
  smoking: "No",
  noSmoking: false,
};
export function ProfileForm({
  value: p,
  onChange,
}: {
  value: Profile;
  onChange: (p: Profile) => void;
}) {
  const set = (key: keyof Profile, v: any) => onChange({ ...p, [key]: v });
  return (
    <View style={{ gap: 20 }}>
      <Field
        label="First name"
        value={p.name}
        onChangeText={(v) => set("name", v)}
        maxLength={40}
      />
      <Field
        label="Date of birth • private"
        placeholder="YYYY-MM-DD"
        value={p.dob}
        onChangeText={(v) => set("dob", v)}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      <Field
        label="City"
        placeholder="e.g. Pune"
        value={p.city}
        onChangeText={(v) => set("city", v)}
        maxLength={60}
      />
      <Field label="Height (cm) · optional" placeholder="e.g. 172" value={p.heightCm == null ? "" : String(p.heightCm)} keyboardType="number-pad" maxLength={3} onChangeText={v => set("heightCm", v === "" ? null : Number(v))} />
      <Field label="About me · optional" placeholder="What would you like someone to know about you?" value={p.bio || ""} maxLength={400} multiline onChangeText={v => set("bio", v)} />
      <Field label="Education · optional" value={p.education || ""} maxLength={100} onChangeText={v => set("education", v)} />
      <Field label="Work · optional" value={p.occupation || ""} maxLength={100} onChangeText={v => set("occupation", v)} />
      <Field label="Languages · optional" placeholder="e.g. Hindi, English" value={p.languages || ""} maxLength={100} onChangeText={v => set("languages", v)} />
      <Label>Relationship status</Label>
      <Chips options={["Single", "Divorced", "Widowed", "Separated", "Prefer not to say"]} selected={[p.relationshipStatus || "Prefer not to say"]} onChange={v => set("relationshipStatus", v[0])} />
      <Label>Do you drink?</Label>
      <Chips options={["Never", "Occasionally", "Yes", "Prefer not to say"]} selected={[p.drinking || "Prefer not to say"]} onChange={v => set("drinking", v[0])} />
      <Body muted>These details are visible on your matching profile. Leave optional details blank if you prefer.</Body>
      <Label>I describe myself as</Label>
      <Chips
        options={GENDERS}
        selected={[p.gender]}
        onChange={(v) => set("gender", v[0])}
      />
      <Label>Open to a relationship with</Label>
      <Chips
        options={GENDERS}
        selected={p.seeking}
        multiple
        max={3}
        onChange={(v) => set("seeking", v)}
      />
      <View style={{ flexDirection: "row", gap: 15 }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Minimum age"
            value={String(p.minAge || "")}
            keyboardType="number-pad"
            onChangeText={(v) => set("minAge", Number(v))}
            maxLength={3}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Maximum age"
            value={String(p.maxAge || "")}
            keyboardType="number-pad"
            onChangeText={(v) => set("maxAge", Number(v))}
            maxLength={3}
          />
        </View>
      </View>
      <Toggle
        label="Only introduce people in my city"
        value={p.localOnly}
        onChange={(v) => set("localOnly", v)}
      />
      <Label>My thoughts on children</Label>
      <Chips
        options={CHILDREN}
        selected={[p.children]}
        onChange={(v) => set("children", v[0])}
      />
      <Label>Do you smoke?</Label>
      <Chips
        options={["No", "Yes"]}
        selected={[p.smoking]}
        onChange={(v) => set("smoking", v[0])}
      />
      <Toggle
        label="A non-smoking partner is essential for me"
        value={p.noSmoking}
        onChange={(v) => set("noSmoking", v)}
      />
      <Body muted>
        These are your choices, not assumptions made by AI. You can change them
        later.
      </Body>
    </View>
  );
}
