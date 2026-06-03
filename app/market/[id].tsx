import { Redirect, useLocalSearchParams } from "expo-router";
import { routes } from "@/shared/routes";

export default function MarketRedirectScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  return <Redirect href={id ? routes.card(id) : routes.home()} />;
}
