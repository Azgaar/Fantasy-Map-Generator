// The app's modules, loaded once the interface language's strings are: their markup is translated as they load
import "@/services/logging";
import "@/components/globals";
import "@/components/options/tabs";

import "@/utils";
import "@/data/supporters";
import "@/data/heightmap-templates";
import "@/data/precreated-heightmaps";
import "@/generators";
import "@/renderers";
import "@/components";
import "@/controllers";
import "@/services";
import "@/generators/styles-legacy";

export { boot } from "@/components/lifecycle";
