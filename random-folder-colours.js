const MODULE = "random-folder-colours";
const SIDEBARS = [
    "Actor",
    "Scene",
    "Item",
    "RollTable",
    "Journal",
    "Cards",
    "Playlist"
];

for (const document of SIDEBARS) {
    Hooks.on(`get${document}DirectoryFolderContext`, (html, entryOptions) => {
        addContext(entryOptions); //Add an option to randomise colours to all sidebar's folder contexts.
    });
}

Hooks.on("renderSidebarTab", (directory, html) => {
    if (!html) return;
    if (directory.tabName === "chat") return;
    if (!game.user.isGM) return;

    let randomizeButton = `
    <a class="header-control" id="randomize-all-folder-colours" title="Randomize All Folder Colours">
        <i class="fas fa-dice"></i>
    </a>`;
    const search = html[0]?.querySelector(`input[name="search"]`);
    search?.insertAdjacentHTML("afterend", randomizeButton); //Insert a randomise all button after the search bar

    html[0]
        ?.querySelector("#randomize-all-folder-colours")
        ?.addEventListener("click", () => {
            randomizeAllFolders(directory);
        });
});

function randomizeAllFolders(directory) {
    const updates = directory.folders.map(i => {
        const color = Color.fromHSV([Math.random(), 0.8, 0.8]).css;
        return { _id: i.id, color: color };
    });
    Folder.updateDocuments(updates);
}

function addContext(entryOptions) {
    entryOptions.push({
        name: "Random Folder Colour",
        icon: '<i class="fas fa-dice"></i>',
        callback: header => {
            const li = header.parent()[0];
            const folder = game.folders.get(li.dataset.folderId);

            const color = Color.fromHSV([Math.random(), 0.8, 0.8]).css;
            while (color === folder.color) {
                ui.notifications.info(
                    "By some miracle of RNG, the random colour generated was the same as the current colour. Generating a new one..."
                );
                color = Color.fromHSV([Math.random(), 0.8, 0.8]).css;
            }
            return folder.update({ color: color });
        },
        condition: () => {
            return game.user.isGM; //Only show to GMs
        }
    });
}
