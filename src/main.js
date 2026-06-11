import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import "./assets/styles/tokens.css";
import "./assets/styles/global.css";

const pinia = createPinia();

createApp(App).use(pinia).use(router).mount("#app");
