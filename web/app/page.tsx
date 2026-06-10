import { getPredictions } from "./lib/data";
import { Dashboard } from "./components/Dashboard";

export default async function Page() {
  const data = await getPredictions();
  return <Dashboard data={data} />;
}
