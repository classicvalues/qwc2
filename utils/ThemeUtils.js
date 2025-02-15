/**
 * Copyright 2018-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import isEmpty from 'lodash.isempty';

import ConfigUtils from '../utils/ConfigUtils';
import LayerUtils from '../utils/LayerUtils';
import {LayerRole} from '../actions/layers';
import {remove as removeDiacritics} from 'diacritics';

const ThemeUtils = {
    getThemeById(themes, id) {
        for (let i = 0, n = themes.items.length; i < n; ++i) {
            if (themes.items[i].id === id) {
                return themes.items[i];
            }
        }
        for (let i = 0, n = themes.subdirs.length; i < n; ++i) {
            const theme = this.getThemeById(themes.subdirs[i], id);
            if (theme) {
                return theme;
            }
        }
        return null;
    },
    createThemeBackgroundLayers(theme, themes, visibleLayer = null) {
        const bgLayers = [];
        let visibleIdx = -1;
        let defaultVisibleIdx = -1;
        for (const entry of (theme.backgroundLayers || [])) {
            if (!entry.name) {
                continue;
            }
            let bgLayer = themes.backgroundLayers.find(lyr => lyr.name === entry.name);
            if (bgLayer) {
                if (entry.visibility === true) {
                    defaultVisibleIdx = bgLayers.length;
                }
                if (bgLayer.name === visibleLayer) {
                    visibleIdx = bgLayers.length;
                }
                bgLayer = {
                    ...bgLayer,
                    role: LayerRole.BACKGROUND,
                    visibility: false,
                    opacity: bgLayer.opacity !== undefined ? bgLayer.opacity : 255
                };
                if (bgLayer.type === "group") {
                    bgLayer.items = bgLayer.items.map(item => {
                        if (item.ref) {
                            const sublayer = themes.backgroundLayers.find(l => l.name === item.ref);
                            if (sublayer) {
                                item = {...item, ...sublayer, ...LayerUtils.buildWMSLayerParams(sublayer)};
                                delete item.ref;
                            } else {
                                item = null;
                            }
                        }
                        return item;
                    }).filter(x => x);
                }
                bgLayers.push(bgLayer);
            } else {
                // eslint-disable-next-line
                console.warn("Could not find background layer " + entry.name);
            }
        }
        if (visibleIdx >= 0) {
            bgLayers[visibleIdx].visibility = true;
        } else if (defaultVisibleIdx >= 0 && visibleLayer !== "") {
            bgLayers[defaultVisibleIdx].visibility = true;
        }
        return bgLayers;
    },
    createThemeLayer(theme, themes, role = LayerRole.THEME, subLayers = []) {
        const layer = {
            type: "wms",
            url: ThemeUtils.fullUrl(theme.url),
            version: theme.version,
            visibility: true,
            expanded: theme.expanded,
            name: theme.name,
            title: theme.title,
            bbox: theme.bbox,
            sublayers: (Array.isArray(subLayers) && subLayers.length) ? subLayers : theme.sublayers,
            tiled: theme.tiled,
            ratio: !theme.tiled ? 1 : undefined,
            serverType: 'qgis',
            format: theme.format,
            role: role,
            attribution: theme.attribution,
            legendUrl: ThemeUtils.fullUrl(theme.legendUrl),
            printUrl: ThemeUtils.fullUrl(theme.printUrl),
            featureInfoUrl: ThemeUtils.fullUrl(theme.featureInfoUrl),
            infoFormats: theme.infoFormats,
            externalLayerMap: {
                ...theme.externalLayerMap,
                ...(theme.externalLayers || []).reduce((res, cur) => {
                    res[cur.internalLayer] = {
                        ...themes.externalLayers.find(entry => entry.name === cur.name)
                    };
                    LayerUtils.completeExternalLayer(res[cur.internalLayer]);
                    return res;
                }, {})
            }
        };
        // Drawing order only makes sense if layer reordering is disabled
        if (ConfigUtils.getConfigProp("allowReorderingLayers", theme) !== true) {
            layer.drawingOrder = theme.drawingOrder;
        }
        return layer;
    },
    searchThemes(themes, searchtext, resultType) {
        const filter = new RegExp(removeDiacritics(searchtext).replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&"), "i");
        const matches = ThemeUtils.searchThemeGroup(themes, filter);
        return isEmpty(matches) ? [] : [{
            id: "themes",
            titlemsgid: "search.themes",
            priority: -1,
            items: matches.map(theme => ({
                type: resultType,
                id: theme.id,
                text: theme.title,
                theme: theme,
                thumbnail: ConfigUtils.getAssetsPath() + "/" + theme.thumbnail
            }))
        }];
    },
    searchThemeGroup(themeGroup, filter) {
        const matches = [];
        (themeGroup.subdirs || []).map(subdir => matches.push(...ThemeUtils.searchThemeGroup(subdir, filter)));
        matches.push(...(themeGroup.items || []).filter(item => {
            return removeDiacritics(item.title).match(filter) || removeDiacritics(item.keywords || "").match(filter) || removeDiacritics(item.abstract || "").match(filter);
        }));
        return matches;
    },
    fullUrl(url) {
        if (!url || url.startsWith('http')) {
            // keep original URL
            return url;
        } else {
            // full URL for relative URL on current location
            return new URL(url, window.location.href).href;
        }
    }
};

export default ThemeUtils;
