import { Stack } from "expo-router";
import AppProvider from "../../App";
export default function Root() {
  return (
    <AppProvider>
      <Stack screenOptions={{ headerShown: false, animation: "none" }} />
    </AppProvider>
  );
}
