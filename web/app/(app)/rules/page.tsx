import { redirect } from "next/navigation";

/** Rules moved into Settings (it's a niche, low-traffic page). Keep this route
 *  as a redirect so old links and bookmarks still land in the right place. */
export default function RulesPage() {
  redirect("/settings#rules");
}
