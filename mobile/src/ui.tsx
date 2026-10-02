import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  TextInputProps,
} from "react-native";
export const C = {
  bg: "#F7F3EB",
  paper: "#FFFDF9",
  ink: "#252C28",
  muted: "#737971",
  line: "#DFE3D8",
  orange: "#B74E30",
  peach: "#F4D9C7",
  sage: "#E5EADD",
  green: "#3F5B44",
  white: "#FFFFFF",
};
export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}
export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={s.title}>{children}</Text>;
}
export function Body({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return <Text style={[s.body, muted && { color: C.muted }]}>{children}</Text>;
}
export function Panel({
  children,
  tint = false,
}: {
  children: React.ReactNode;
  tint?: boolean;
}) {
  return (
    <View style={[s.panel, tint && { backgroundColor: C.sage }]}>
      {children}
    </View>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        danger && { backgroundColor: "#863E36" },
        (disabled || busy) && { opacity: 0.45 },
        pressed && { opacity: 0.75 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? C.ink : C.white} />
      ) : (
        <Text style={[s.buttonText, secondary && { color: C.ink }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
export function Field({ label, ...p }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#92988E"
        {...p}
        style={[
          s.input,
          p.multiline && { minHeight: 105, textAlignVertical: "top" },
          p.style,
        ]}
      />
    </View>
  );
}
export function Chips({
  options,
  selected,
  onChange,
  multiple = false,
  max = 99,
}: {
  options: string[];
  selected: string[];
  onChange: (s: string[]) => void;
  multiple?: boolean;
  max?: number;
}) {
  return (
    <View style={s.wrap}>
      {options.map((x) => (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected.includes(x) }}
          key={x}
          onPress={() =>
            onChange(
              multiple
                ? selected.includes(x)
                  ? selected.filter((v) => v !== x)
                  : selected.length < max
                    ? [...selected, x]
                    : selected
                : [x],
            )
          }
          style={[s.chip, selected.includes(x) && s.selected]}
        >
          <Text
            style={{
              color: selected.includes(x) ? C.white : C.ink,
              fontSize: 14,
            }}
          >
            {x}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={s.toggle}
    >
      <View
        style={[
          s.box,
          value && { backgroundColor: C.green, borderColor: C.green },
        ]}
      >
        <Text style={{ color: C.white }}>{value ? "✓" : ""}</Text>
      </View>
      <Text style={[s.body, { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}
export function ErrorText({ message }: { message: string }) {
  return message ? (
    <View
      accessibilityRole="alert"
      style={{ padding: 14, backgroundColor: "#FBE5DF", borderRadius: 14 }}
    >
      <Text style={{ color: "#852E20", lineHeight: 21 }}>{message}</Text>
    </View>
  ) : null;
}
export function Mark({ small = false }: { small?: boolean }) {
  return (
    <View
      style={{
        height: small ? 44 : 110,
        width: small ? 44 : 150,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: small ? 25 : 67,
          height: small ? 25 : 67,
          borderRadius: 70,
          borderWidth: small ? 2 : 3,
          borderColor: C.orange,
          position: "absolute",
          left: small ? 2 : 17,
          transform: [{ rotate: "-25deg" }],
        }}
      />
      <View
        style={{
          width: small ? 25 : 67,
          height: small ? 25 : 67,
          borderRadius: 70,
          borderWidth: small ? 2 : 3,
          borderColor: C.green,
          position: "absolute",
          right: small ? 2 : 17,
          transform: [{ rotate: "25deg" }],
        }}
      />
      <View
        style={{
          height: small ? 4 : 8,
          width: small ? 4 : 8,
          borderRadius: 8,
          backgroundColor: C.orange,
          position: "absolute",
          top: small ? 5 : 10,
          right: small ? 4 : 30,
        }}
      />
    </View>
  );
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: {
    padding: 24,
    gap: 20,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  title: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 35,
    lineHeight: 41,
    color: C.ink,
    fontWeight: "400",
  },
  body: { fontSize: 16, lineHeight: 25, color: C.ink },
  label: {
    fontSize: 11,
    letterSpacing: 1.9,
    fontWeight: "700",
    color: C.muted,
    textTransform: "uppercase",
  },
  panel: {
    backgroundColor: C.paper,
    borderRadius: 22,
    padding: 22,
    gap: 14,
    borderWidth: 1,
    borderColor: C.line,
  },
  button: {
    backgroundColor: C.orange,
    paddingHorizontal: 20,
    minHeight: 52,
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#BEC8B9",
  },
  buttonText: { color: C.white, fontSize: 15, fontWeight: "600" },
  input: {
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 13,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 16,
    color: C.ink,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 25,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: C.paper,
  },
  selected: { backgroundColor: C.green, borderColor: C.green },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 5,
  },
  box: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: C.muted,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  rule: { height: 1, backgroundColor: C.line },
  caption: { color: C.muted, fontSize: 12, lineHeight: 19 },
  tab: { flex: 1, alignItems: "center", gap: 5, paddingVertical: 13 },
  nav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: C.line,
    backgroundColor: C.paper,
  },
  bubble: {
    padding: 17,
    borderRadius: 18,
    backgroundColor: C.paper,
    maxWidth: "92%",
    borderWidth: 1,
    borderColor: C.line,
  },
  self: { alignSelf: "flex-end", backgroundColor: C.sage, borderColor: C.sage },
  avatar: {
    height: 55,
    width: 55,
    borderRadius: 28,
    backgroundColor: C.peach,
    alignItems: "center",
    justifyContent: "center",
  },
});
