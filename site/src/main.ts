import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import { mount } from "svelte";
import App from "./App.svelte";
import "./app.css";

mount(App, { target: document.getElementById("app")! });
