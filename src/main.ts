// Azgaar and contributors, 2017-2026. MIT License
// https://github.com/Azgaar/Fantasy-Map-Generator

import "@/services/logging";
import "@/components/globals";

import "@/utils";
import "@/data/supporters";
import "@/data/view-3d-options";
import "@/data/heightmap-templates";
import "@/data/precreated-heightmaps";
import "@/generators";
import "@/renderers";
import "@/components";
import "@/controllers";
import "@/services";
import "@/generators/styles-legacy";

import { boot } from "@/components/lifecycle";

document.addEventListener("DOMContentLoaded", boot);
