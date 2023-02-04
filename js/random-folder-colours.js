import ColorHelpers from "./color-helpers.js";

export const MODULE = "random-folder-colours";
const SIDEBARS = ["Actor", "Scene", "Item", "RollTable", "Journal", "Cards", "Playlist"];
let colormindCache = [];

Hooks.on("init", () => {
    game.settings.register(MODULE, "randomMode", {
        name: "Random Colour Mode",
        hint: "Whether to use a purely random colour, or use Colormind to generate a set of random colours.",
        scope: "world",
        config: true,
        requiresReload: false,
        type: String,
        choices: {
            random: "Random",
            colormind: "Colormind"
        },
        onchange: async (change) => {
            if (change === "colormind") {
                await createCache(game.settings.get(MODULE, "colormindCacheSize"));
            }
        },
        default: "colormind"
    });

    game.settings.register(MODULE, "colormindCacheSize", {
        name: "Colourmind Cache Size",
        hint: "The number of colours to pre-fetch from Colormind. Set to 0 to disable caching.",
        scope: "world",
        config: true,
        requiresReload: false,
        type: Number,
        range: {
            min: 0,
            max: 100,
            step: 5
        },
        default: 50,
        onchange: async (change) => {
            await createCache(change);
        }
    });

    game.settings.register(MODULE, "similarityThreshold", {
        name: "Random Colour Similarity Threshold",
        hint: "If the DeltaE value of two randomly generated colours is below this threshold, a new colour will be generated. Set to 0 to disable. (DeltaE is a measure of visual similarity of colours, 0 being identical, 100 being complete opposites.)",
        scope: "world",
        config: true,
        requiresReload: false,
        type: Number,
        range: {
            min: 0,
            max: 20,
            step: 1
        },
        default: 20
    });

    for (const document of SIDEBARS) {
        //Add an option to randomise individual folders colours to all sidebars.
        Hooks.on(`get${document}DirectoryFolderContext`, (html, entryOptions) => {
            addContext(entryOptions);
        });
    }
});

Hooks.on("renderSidebarTab", (directory, html) => {
    //Insert a randomise all button after the search bar
    if (!html) return;
    if (directory.tabName === "chat") return;
    if (!game.user.isGM) return;

    let randomizeButton = `
    <a class="header-control" id="randomize-all-folder-colours" title="Randomize All Folder Colours">
        <i class="fas fa-dice"></i>
    </a>`;
    const search = html[0]?.querySelector(`input[name="search"]`);
    search?.insertAdjacentHTML("afterend", randomizeButton);

    html[0]?.querySelector("#randomize-all-folder-colours")?.addEventListener("click", () => {
        if (game.settings.get(MODULE, "randomMode") === "random") {
            randomizeAllFolders(directory);
        } else {
            randomizeAllFoldersColormind(directory);
        }
    });
});

Hooks.on("ready", async () => {
    if (!game.user.isGM) return;
    //If the random mode is colormind, generate a cache of the desired size
    if (game.settings.get(MODULE, "randomMode") === "colormind") {
        createCache(
            game.settings.get(MODULE, "colormindCacheSize")
            //Divided by 5 because Colormind provides an array of 5 colors. Otherwise a setting of 10 would provide 50 colours
        );
    }
});

async function createCache(size) {
    if (!game.user.isGM) return;
    //Generate a cache of the desired size
    let start = window.performance.now();

    console.info(`Random Folder Colours | Building cache of ${size} colours...`);
    let cache = colormindCache;
    while (cache.length < size) {
        const set = await callColormind();
        // Spread the array of 5 colors, so the cache remains flat.
        cache.push(...set);
    }
    let end = window.performance.now();
    console.info(`Random Folder Colours | Cache of ${cache.length} colours built in ${Math.round(end - start)} ms.`);
}

async function getColormindCache(size) {
    //Splice a desired number of elements off the start of the array to be used as a colour
    if (colormindCache.length < size) {
        //Check to see if we have enough elements to return first
        await createCache(game.settings.get(MODULE, "colormindCacheSize") + size);
    }

    let set = colormindCache.splice(0, size);

    return set;
}

async function randomizeAllFolders(directory) {
    //Generate randoms HSV colours and assign them to all folders in a given directory
    let updates = directory.folders.map((i) => {
        const color = Color.fromHSV([Math.random(), Math.random() * 0.2 + 0.7, Math.random() * 0.2 + 0.7]).css;
        return { _id: i.id, color: color };
    });

    ColorHelpers.checkSimilarity(updates);
    await Folder.updateDocuments(updates);
}

function addContext(entryOptions) {
    //Add a randomise button to the folder context menu
    entryOptions.push({
        name: "Random Folder Colour",
        icon: '<i class="fas fa-dice"></i>',
        callback: (header) => {
            const li = header.parent()[0];
            const folder = game.folders.get(li.dataset.folderId);

            const color = Color.fromHSV([Math.random(), Math.random() * 0.2 + 0.7, Math.random() * 0.2 + 0.7]).css;
            while (color === folder.color) {
                ui.notifications.info(
                    "By some miracle of RNG, the random colour generated was the same as the current colour. Generating a new one..."
                );
                color = Color.fromHSV([Math.random(), Math.random() * 0.2 + 0.7, Math.random() * 0.2 + 0.7]).css;
            }
            return folder.update({ color: color });
        },
        condition: () => {
            return game.user.isGM; //Only show to GMs
        }
    });
}

//Connect to colormind and get an array of 5 colours, themselves a 0-255 RGB tuple.
async function callColormind() {
    let response = await fetch("http://colormind.io/api/", {
        method: "POST",
        body: JSON.stringify({
            model: "default"
        })
    });
    if (!response.ok) return console.error("Failed to reach Colormind.");
    let result = await response.json();
    result = result.result;

    return result;
}

//Randomise all folders with a colour from colourmind
async function randomizeAllFoldersColormind(directory) {
    let cached = [];
    let colors = [];

    //Convert 0-255 ints to 0-1 floats
    cached = (await getColormindCache(directory.folders.length)).map((i) => {
        return Color.fromRGB([i[0] / 255, i[1] / 255, i[2] / 255]);
    });
    colors.push(...cached);

    const updates = directory.folders.map((i, index) => {
        const color = colors[index].css;
        return { _id: i.id, color: color };
    });

    await Folder.updateDocuments(updates);
}
