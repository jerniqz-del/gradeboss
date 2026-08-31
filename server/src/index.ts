import { createApp } from "./app.js";
import { Store, defaultDataFile } from "./store.js";

const PORT = Number(process.env.PORT) || 3001;
const store = new Store(process.env.GRADEBOSS_DATA_FILE || defaultDataFile);
const app = createApp(store);

app.listen(PORT, () => {
  console.log(`GradeBoss API listening on http://localhost:${PORT}`);
});
