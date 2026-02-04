"use strict";

window.ServerAPI = (function () {
    const base =  "./";
    let ok = false;

    function checkData(data){
        if (data === null) {
            return false;
        }
        if (typeof data.ok != "boolean" || typeof data.info != "string") {
            return false;
        }

        ok = data.ok;
        return true;
    }


    function buildUrl(path, params) {
        const p = String(path || "");
        const normalizedPath = p.startsWith("/") ? p : `/${p}`;

        let url = `${base}${normalizedPath}`;

        if (params && typeof params === "object") {
            const qs = new URLSearchParams();

            Object.keys(params).forEach((key) => {
                const val = params[key];
                if (val === undefined || val === null) return;

                if (Array.isArray(val)) val.forEach((item) => qs.append(key, String(item)));
                else qs.append(key, String(val));
            });

            const query = qs.toString();
            if (query) url += (url.includes("?") ? "&" : "?") + query;
        }

        return url;
    }

    function toTextBlob(mapData) {
        if (mapData instanceof Blob) return mapData;
        return new Blob([mapData], { type: "text/plain" });
    }

    async function readJsonSafe(res) {
        if (!res) return null;
        if (res.status === 204) return null;

        const headers = res.headers;
        const ct = headers && headers.get ? (headers.get("content-type") || "") : "";
        const looksJson = ct.includes("application/json") || ct.includes("+json");

        if (looksJson) {
            try {
                const data = await res.json();
                checkData(data);
                return data;

            } catch (e) {
                console.error("ServerAPI JSON-parse failed:", e);
                ok = false;
                return null;
            }
        }

        try {
            const text = await res.text();
            if (!text) return null;

            try {
                const data = JSON.parse(text);
                checkData(data);
                return data;

            } catch (e) {
                ok = false;
                return { ok: false, info: text };
            }
        } catch (e) {
            console.error("ServerAPI plain-parse failed:", e);
            ok = false;
            return null;
        }
    }

    async function getJson(path, params) {
        if (!ok) {return null;}

        const url = buildUrl(path, params);

        try {
            const res = await fetch(url, {
                method: "GET",
                headers: { Accept: "application/json" }
            });

            if (!res.ok) {
                const payload = await readJsonSafe(res);
                console.error("ServerAPI GET failed:", { url, status: res.status, payload });
                return null;
            }

            return await readJsonSafe(res);
        } catch (error) {
            console.error("ServerAPI GET error:", { url, error });
            return null;
        }
    }

    async function postData(path, mapData, params) {
        if (!ok) {return null;}

        const url = buildUrl(path, params);
        const body = toTextBlob(mapData);

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { Accept: "application/json" },
                body
            });

            if (!res.ok) {
                const payload = await readJsonSafe(res);
                console.error("ServerAPI POST failed:", { url, status: res.status, payload });
                return null;
            }

            return await readJsonSafe(res);
        } catch (error) {
            console.error("ServerAPI POST error:", { url, error });
            return null;
        }
    }

    return {
        checkData,
        getJson,
        postData
    };
})();

(async () => {
    const data = await window.ServerAPI.getJson("api/info.json", null);
    if (!window.ServerAPI.checkData(data)) {
        return;
    }

    console.log("[ServerAPI][enabled]: ", data.info);
})();