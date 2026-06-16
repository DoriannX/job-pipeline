import { redirect } from "next/navigation";

// Racine de l'app — n'affiche RIEN d'autre : redirige vers /aujourdhui (écran par défaut,
// story 1.4 / architecture.md §routes). La garde d'auth de (app)/layout.tsx prend ensuite
// le relais : connecté ⇒ /aujourdhui s'affiche ; non connecté ⇒ /login.
export default function Home() {
  redirect("/aujourdhui");
}
