const getDayFromDb = async (retailer_data) => {
    app.log(retailer_data, "--RETAIL DATA 2 - getDayFromDB FN--")

    let region = (retailer_data && retailer_data.region) ? retailer_data.region : null
    app.log(region, "--REGION NAME - getDayFromDB FN--")

    let region_name = (region) ? region : "default"
    app.log(region_name, "--REGION NAME 2 - getDayFromDB FN--")

    let day = "1"

    await app.datastore.search({
        table: "days",
        body: {
            "query": {
                "bool": {
                    "must": [
                        {
                            "match": {
                                "region.keyword": region_name
                            }
                        }
                    ]
                }
            }
        }
    }).then((res) => {
        if (res && res.hits && res.hits.hits && res.hits.hits.length > 0) {
            let region_db = res.hits.hits[0]._source.region
            let mon = res.hits.hits[0]._source.mon
            let tue = res.hits.hits[0]._source.tue
            let wed = res.hits.hits[0]._source.wed
            let thu = res.hits.hits[0]._source.thu
            let fri = res.hits.hits[0]._source.fri
            let sat = res.hits.hits[0]._source.sat
            let sun = res.hits.hits[0]._source.sun

            // let arr = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

            let curr_day = app.moment().add(7, 'hours').day()//new Date().getDay()
            app.log(curr_day, "--CURRENT DAY - getDayFromDB FN--")

            if (curr_day == 0) {
                day = sun
            }
            else if (curr_day == 1) {
                day = mon
            }
            else if (curr_day == 2) {
                day = tue
            }
            else if (curr_day == 3) {
                day = wed
            }
            else if (curr_day == 4) {
                day = thu
            }
            else if (curr_day == 5) {
                day = fri
            }
            else if (curr_day == 6) {
                day = sat
            }

            return day

        }
    })
    return day;

    // resolve();
};

const getRetailersDetail = async (phone, priority) => {
    app.log({ phone })
    let body = {
        query: {
            "bool": {
                "must": [
                    {
                        "match_phrase": {
                            "phone": phone
                        }
                    },
                    {
                        "match_phrase": {
                            "priority": priority
                        }
                    }
                ],
            }
        },
        size: 1
    }
    const retailersData = await app.dataStore.search({
        table: 'retailers',
        body: body
    }).catch(() => {
        app.executeFunction('insertDatabaseQueryTime', {
            table: 'retailers',
            query: body,
            error: true
        });
        return null
    })
    if (retailersData && retailersData.hits.hits.length > 0) {
        app.executeFunction('insertDatabaseQueryTime', {
            table: 'retailers',
            query: body,
            took: retailersData.took,
            length: retailersData.hits.hits.length
        });
        app.memory.set('retailer_data', retailersData.hits.hits[0]._source)
        app.log('retailer_data memory phonenumberprompt-->', retailersData.hits.hits[0]._source)
        return retailersData.hits.hits[0]._source
    }
    return null
}

const getRetailersByPhone = async (phone) => {
    let body = {
        query: {
            "bool": {
                "must": [
                    {
                        "match_phrase": {
                            "phone": phone
                        }
                    }
                ],
            }
        },
        sort: [
            {
                "priority.keyword": {
                    "order": "asc" // or "desc" for descending order
                }
            }
        ]
    };
    const retailersData = await app.dataStore.search({
        table: 'retailers',
        body: body
    }).catch(() => {
        app.executeFunction('insertDatabaseQueryTime', {
            table: 'retailers',
            query: body,
            error: true
        });
        return null;
    });

    if (retailersData && retailersData.hits.hits.length > 0) {
        app.log('retailer_data all region -->', retailersData.hits.hits);
        return retailersData.hits.hits;
    }
    return null;
};

const getHolidaysByRegion = async (region, date) => {
    app.log('HOLIDAY DATA by Region');

    app.log('dateHoliday = ' + date + " | region : " + region);
    let holiday = await app.dataStore.search({
        table: 'holiday',
        body: {
            query: {
                "bool": {
                    "must": [
                        {
                            "match_phrase": {
                                "holiday_date": date
                            }
                        },
                        {
                            "match_phrase": {
                                "region": region
                            }
                        }
                    ]
                }
            }
        },
        limit: 10000
    }).catch(() => {
        return null;
    });

    if (holiday && holiday.hits.hits.length) {
        return holiday.hits.hits.find((data) => data._source.region.toLowerCase() === region.toLowerCase());
    }
    return false;
};

const collectProducts = async (region) => {
    app.log(`=======IN COLLECT PRODUCT ${region}=======`)
    let body = {
        query: {
            "bool": {
                "must": [{ "match_phrase": { "region": region } }],
                "must_not": [{ "match_phrase": { "stocks": 0 } }, { "match_phrase": { "stick": 0 }}]
            }
        },
        size: 5000
    }
    let productData = await app.dataStore.search({
        table: `products`,
        body: body
    }).catch(() => { return null })
    if (productData && productData.hits.hits.length) {
        let productList = []
        productData.hits.hits.forEach((product) => {
            if (product._source.region.toLowerCase() === region.toLowerCase()) {
                productList.push(product._source)
            }
        })
        app.memory.set('product_data', productData);
        app.memory.set('products', productList);
        return;
    }
    app.memory.set('product_data', null);
    app.memory.set('products', []);
    return
}

const collectPackages = async (region) => {
    let packagebody = {
        "query": {
            "bool": {
                "must": [
                    {
                        "match_phrase": {
                            "region": region
                        }
                    }
                ]
            }
        },
        "size": 10000
    }
    let packageItems = await app.dataStore.search({
        table: 'package_items',
        body: packagebody
    }).catch((e) => {
        app.executeFunction('insertDatabaseQueryTime', {
            table: 'package_items',
            query: packagebody,
            error: true
        });
        app.log("====Failed search in package_items=====");
        return null;
        app.log(e, 'ERROR DB')
    });

    if (packageItems) {
        app.executeFunction('insertDatabaseQueryTime', {
            table: 'package_items',
            query: packagebody,
            took: packageItems.took,
            length: packageItems.hits.hits.length
        });
    }
    if (packageItems && packageItems.hits.hits.length) {
        app.memory.set('package_items', packageItems);
        return packageItems;
    } else {
        app.memory.set('package_items', null);
        return null
    }
}

function editDistance(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    let costs = new Array();
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i == 0) {
                costs[j] = j;
            } else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1)) {
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    }
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) {
            costs[s2.length] = lastValue;
        }
    }
    return costs[s2.length];
}

function similarity(s1, s2) {
    let longer = s1;
    let shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }
    let longerLength = longer.length;
    if (longerLength == 0) {
        return 1.0;
    }
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

const getCartQuantity = async () => {
    try {
        let result = await app.memory.get('carts');
        // app.log(result, 'KOMODO')

        return JSON.parse(result)
    } catch (e) {
        app.log(e)
        return [];
    }
}

const formatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR'
});

const updateImpression = async (products) => {
    await products.map(data => {
        app.dataStore.update({
            table: `products`,
            record: {
                _id: data._id,
                impression: isNaN(data.impression) ? 0 : parseInt(data.impression) + 1
            },
        });
    });
}
app.log(app.data, 'HASANNNN')
let onSearch = false;
let subFamily = false;

const getProduct = async (carts, retailerData) => {

    try {
        console.log(app.data.event ? app.data.event.search : app.context.steps['showProduct'], 'DOOOR')
        const search = app.data.event ? app.data.event.search : app.context.steps['showProduct'] //await app.memory.get('search_products');
        const subfamily = app.data.event ? app.data.event.subfamily : false;
        const offering = app.data.event ? app.data.event.offering : false;
        const promo = app.data.event ? app.data.event.promo : false;
        app.log(app.data.event, 'INCOMING EVENT ========')
        app.log({ search, subfamily, offering, promo }, 'SEARCH VALUE')

        if (promo) {
            app.log("PROMO SHOW PRODUCT")
            let products = await app.memory.get('products');
            products = JSON.parse(products);
            let queryProduct = [];
            let promos = []
            await promo.split(',').forEach(p => {
                let skuid = p.split(':')[0];
                let qty = p.split(':')[1];
                if (skuid && qty) {
                    app.log({ skuid, qty })
                    let found = products.find(x => x.sku_id == skuid);
                    app.log({ found })
                    if (found) {
                        found.itemCount = qty;
                        queryProduct.push(found);
                        app.log(queryProduct, "queryProduct")
                    }
                }
            });

            return queryProduct;
        }
        //Show searched product or subfamily product
        if ((search && search != 'Tambah Produk Lain ➕' && search != 'Add Another Product ➕' && search != '~~~' && !promo) || subfamily) {
            let products = await app.memory.get('products');
            products = JSON.parse(products);
            let queryProduct = [];
            if (subfamily) {
                queryProduct = products.filter(x => x.sub_family && x.sub_family.toLowerCase() == subfamily.toLowerCase());
                let defaultSort = [];
                let configuredSort = [];
                queryProduct.forEach(product => {
                    app.log(product)
                    if (product.sub_family_display_sort) {
                        configuredSort.push(product)
                    } else {
                        defaultSort.push(product)
                    }
                });
                let sortedProduct = configuredSort.sort((a, b) => parseInt(a.sub_family_display_sort) - parseInt(b.sub_family_display_sort));

                queryProduct = [...sortedProduct, ...defaultSort]
            } else {
                search.split('|').forEach(s => {
                    products.forEach(product => {
                        if (product.aliases.toLowerCase().includes(s)) {
                            queryProduct.push(product)
                        }
                    });
                });

                if (!queryProduct.length) {
                    search.split('|').forEach(s => {
                        let _products = [];
                        products.forEach(x => _products.push(x));

                        _products.map(product => {
                            // app.log(product.aliases, 'PRODUCT ALIASES')
                            // app.log(s, 'PRODUCT ALIASES QUERY SEARCH')
                            let aliases = product.aliases.replace(/[' ']/g, '').split(',');
                            let sim = 0;
                            aliases.forEach(alias => {
                                let simil = similarity(alias, s.replace(/[' ']/g, ''))
                                simil > sim ? sim = simil : sim;
                            })

                            product.similarity = sim;
                        });
                        let maxSim = Math.max(...products.map(x => x.similarity));
                        // app.log(maxSim, 'MAX SIMILARITY')
                        let result = maxSim > 0.5 ? products.filter(x => {
                            // app.log({
                            //     name: x.name,
                            //     sim: x.similarity,
                            //     maxSim: maxSim
                            // })
                            return x.similarity == maxSim
                            // return x.similarity >= maxSim - (maxSim * 0.1)
                        }) : [];
                        result.forEach(res => {
                            let find = queryProduct.find(x => x.sku_id == res.sku_id);
                            if (!find) {
                                queryProduct.push(res)
                            }
                        })
                    })
                }
            }


            if (subfamily) { subFamily = true }
            onSearch = true;
            // app.log(queryProduct.sort((a, b) => a.name > b.name && 1 || -1), 'FETCH DB');
            // app.log(queryProduct.length, 'FETCH DB LEN');

            if (search && onSearch && queryProduct.length == 0) {
                // let retailer = await app.dataStore.find({
                //     table: 'retailers',
                //     query: {
                //         phone: app.profile.payload ? app.profile.payload.split('/')[0] : ''
                //     },
                //     limit: 1
                // });

                // let productExStock = await app.dataStore.find({
                //     table: "products",
                //     query: {
                //         aliases: { '$regex': search, '$options': 'i' }
                //     },
                //     limit: 5000
                // });

                // if (retailer.length) {
                await app.dataStore.insert({
                    table: 'unidentified_search',
                    record: {
                        customer_code: retailerData.store_code,
                        words: search
                    }
                });
                // }

            }

            await queryProduct.forEach(item => {
                const found = carts.find(x => x.code == item.sku_id);

                if (found) {
                    item.itemCount = found.quantity
                }
            });


            await app.memory.delete('search_products')
            await updateImpression(queryProduct, retailerData)
            // const arrProducts = queryProduct.hits.hits;
            // const arrProducts = queryProduct
            let seen = {};
            const arrProducts = queryProduct.filter(item => {
                if (seen[item.sku_id]) {
                    return false;
                } else {
                    seen[item.sku_id] = true;
                    return true;
                }
            });
            // let availableProductByRegion = await app.executeFunction('filterProductByRegion', { products: arrProducts, retailerData: retailerData })
            return arrProducts;
        }

        //Show initial product list
        else {
            if (search == 'Tambah Produk Lain ➕' || search == "Add Another Product ➕") {
                app.sendTextMessage('Ketikkan nama produk yang ingin anda pilih beserta jumlahnya.Anda dapat menggunakan koma untuk membeli lebih dari satu produk😀')
            }

            let productList = []
            let personalizedSkuIds = [];
            let personalizedProducts = await app.dataStore.search({
                table: `personalized_show_products`,
                body: {
                    query: {
                        "bool": {
                            "must": [
                                {
                                    "match_phrase": { "region": retailerData.region }
                                },
                                {
                                    "match_phrase": { "store_code": retailerData.store_code }
                                }],
                        }
                    },
                    size: 1
                }
            }).catch(err => { return null });
            if (personalizedProducts && personalizedProducts.hits.hits.length) {
                personalizedProducts = personalizedProducts.hits.hits[0]._source;

                if (typeof personalizedProducts.sku_ids == "string") {
                    let seen = {};
                    personalizedProducts.sku_ids.split(',').forEach(sku => {
                        if (typeof sku == "string") {
                            if (!seen[sku.trim()]) {
                                personalizedSkuIds.push(sku.trim());
                                seen[sku.trim()] = true;
                            }
                        }
                    });
                }
            }
            // let body = {
            //     query: {
            //         "bool": {
            //             "must": [{ "match_phrase": { "region": retailerData.region } }],
            //             "must_not": [{ "match_phrase": { "stocks": 0 } }]
            //         }
            //     },
            //     size: 5000
            // }

            // let queryProduct = await app.dataStore.search({
            //     table: `products`,
            //     body: body
            // }).catch(() => { 
            //     app.executeFunction('insertDatabaseQueryTime', {
            //         table: 'products',
            //         query: body,
            //         error: true
            //     });
            //     return null
            // });
            let queryProduct = await app.memory.get('product_data');
            queryProduct = JSON.parse(queryProduct);

            if (queryProduct && queryProduct.hits.hits.length) {
                // app.executeFunction('insertDatabaseQueryTime', {
                //     table: 'products',
                //     query: body,
                //     took: queryProduct.took,
                //     length: queryProduct.hits.hits.length
                // });
                let seen = {}
                await queryProduct.hits.hits.forEach((product) => {
                    if (product._source.region.toLowerCase() === retailerData.region.toLowerCase() && !seen[product._source.sku_id]) {
                        productList.push(product._source);
                        seen[product._source.sku_id] = true;
                    }
                });
            }

            // check Offerings
            if (offering) {
                productList = await productList.filter((product) => {
                    if (product.offering && product.offering.toLowerCase() === 'true') {
                        return product
                    }
                })
            } else {
                if (personalizedSkuIds.length) {
                    let products = [];
                    await personalizedSkuIds.forEach((sku) => {
                        let product = productList.find(data => data.sku_id.toLowerCase() == sku.toLowerCase());
                        if (product) {
                            products.push(product);
                        }
                    });
                    productList = products;
                } else {
                    productList = await productList.filter((product) => {
                        if (product.show_first == true || (typeof product.show_first === 'string' && product.show_first.toLowerCase() === 'true')) {
                            return product
                        }
                    })
                }
            }


            let sortedProduct = []
            if (personalizedSkuIds.length && productList.length) {
                sortedProduct = productList;
            } else {
                productList.forEach((product) => {
                    const findIdx = sortedProduct.findIndex((temp) => parseInt(product['display_sort']) <= parseInt(temp['display_sort']))
                    if (findIdx < 0) {
                        sortedProduct.push(product)
                    } else {
                        if (parseInt(product['display_sort']) == parseInt(sortedProduct[findIdx]['display_sort'])) {
                            if (parseInt(product['name']) > parseInt(sortedProduct[findIdx]['name'])) {
                                sortedProduct.splice(findIdx + 1, 0, product)
                                return;
                            }
                        }
                        sortedProduct.splice(findIdx, 0, product)
                    }
                })
            }


            // sortedProduct.forEach((product) => {
            //     // app.log(`=============${product.name} #${product.display_sort}========`)
            // })


            await productList.forEach(item => {
                const found = carts.find(x => x.code == item.sku_id);
                if (found) {
                    item.itemCount = found.quantity
                }
            });

            // let hasDisplaySort = await app._.sortBy(productList.filter((product) => product.display_sort), ['display_sort'])
            // hasDisplaySort.forEach((product) => {
            //     app.log(`=============${product.name} #${product.display_sort}========`)
            // })
            // app.log(hasDisplaySort, '==========HAS DISPLAY SORT=======')
            // let hasNoDisplaySort = await app._.sortBy(productList.filter((product) => !product.display_sort), ['name'])
            // const sortedProduct = hasDisplaySort.concat(hasNoDisplaySort)
            // // app.log(sortedProduct, 'SORTED CATALOG')
            return sortedProduct
        }

    } catch (e) {
        app.log(e, 'err in getProduct - promptShowProduct');
    }
}

const getProductFamily = async (retailerData) => {
    // let body = {
    //     query: {
    //         "bool": {
    //             "must": [{ "match_phrase": { "region": retailerData.region } }],
    //             "must_not": [{ "match_phrase": { "stocks": 0 } }]
    //         }
    //     },
    //     "size": 5000
    // }
    // let productFamily = await app.dataStore.search({
    //     table: `products`,
    //     body: body
    // }).catch((e) => {
    //     app.executeFunction('insertDatabaseQueryTime', {
    //         table: 'products',
    //         query: body,
    //         error: true
    //     });
    //     return null
    //     app.log(e, 'ERROR DB')
    // })
    let productFamily = await app.memory.get('product_data');
    productFamily = JSON.parse(productFamily);

    if (productFamily && productFamily.hits.hits.length) {

        // app.executeFunction('insertDatabaseQueryTime', {
        //     table: 'products',
        //     query: body,
        //     took: productFamily.took,
        //     length: productFamily.hits.hits.length
        // });

        productFamily = productFamily.hits.hits.filter((product) => product._source.region.toLowerCase() === retailerData.region.toLowerCase())
        productFamily = app._.uniqBy(productFamily, '_source.sub_family')
        let returnProductFamily = []
        // let card = {
        //     title: "Produk Family yang tersedia",
        //     actions: []
        // }
        productFamily.forEach((productFamily) => {
            if (productFamily._source.sub_family && productFamily._source.sub_family.toLowerCase() !== 'others') {
                // card.actions.push({
                //     title: productFamily._source.sub_family,
                //     originalText: productFamily._source.sub_family.toLowerCase(),
                //     text: `/${productFamily._source.sub_family.toLowerCase().split(' ').join('')}/`
                // })
                // let card = {
                //     title: productFamily._source.sub_family,
                //     actions: [{
                //         title: "Lihat Produk",
                //         originalText: productFamily._source.sub_family.toLowerCase(),
                //         text: `/${productFamily._source.sub_family.toLowerCase().split(' ').join('')}/`
                //     }]
                // }
                // returnProductFamily.push(card)
                returnProductFamily.push({
                    title: productFamily._source.sub_family,
                    originalText: productFamily._source.sub_family.toLowerCase(),
                    text: `/${productFamily._source.sub_family.toLowerCase().split(' ').join('')}/`
                })
            }
        })
        returnProductFamily = app._.sortBy(returnProductFamily, 'title')
        if (productFamily.find((product) => product._source.sub_family && product._source.sub_family.toLowerCase() === 'others')) {
            // card.actions.push({
            //     title: 'Others',
            //     originalText: 'others',
            //     text: `/others/`
            // })
            // let card = {
            //     title: 'Others',
            //     actions: [{
            //         title: "Lihat Produk",
            //         originalText: 'others',
            //         text: `/others/`,
            //     }]
            // }
            // returnProductFamily.push(card)
            returnProductFamily.push({
                title: 'Others',
                originalText: 'others',
                text: `/others/`
            })
        }
        // returnProductFamily.push(card)
        app.memory.set('product-family', returnProductFamily)
        return returnProductFamily
    }
    return []
}

const wrongRemove = async () => {
    try {
        const wrong = await app.memory.get('wrong_remove');
        if (wrong) {
            await app.memory.delete('wrong_remove');
            return true
        }
    } catch (err) {
        app.log(err)
        return false
    }
}

function processString(inputString) {

    if (!inputString) {
        return {
            stringsOutsideBrackets: [''],
            stringsInsideBrackets: []
        };
    }

    let pattern = /\[([^\]]*)\]/g;

    // Extract strings inside square brackets and remove extra spaces
    let matches = inputString.match(pattern) || [];
    let stringsInsideBrackets = matches.map(match => match.replace(/\[([^\]]*)\]/, '$1').trim());

    // Remove strings inside square brackets and remove extra spaces
    let stringWithoutBrackets = inputString.replace(/\[([^\]]*)\]/g, '').replace(/\s+/g, ' ').trim();

    return {
        stringsOutsideBrackets: [stringWithoutBrackets],
        stringsInsideBrackets: stringsInsideBrackets
    };
}


return new Promise(async resolve => {

    // --TRIGGER BANNER FUNCTION--
    // app.executeFunction('banner')
    // app.sendWebView('', 'https://hasannabil97.github.io/Sampoerna.github.io/index.html', 600, { fullWidthWidget: true }).then(() => { resolve() })
    app.options.i18n = true;
    const offering = app.data.event ? app.data.event.offering : false;

    //////////NEW CODE BY EGRI
    /////////
    //Is user validated?
    // app.executeFunction('showBanner')
    let retailerData = await app.memory.get('retailer_data').catch(() => { return null })
    if (!retailerData) {
        // app.sendTextMessage("TESTRETAILER retailer_data");
        app.delayedMessage({ code: 'welcome-viber' }, {}, 200)
        return
    }
    app.log("retailerData start show product", retailerData);

    // await app.sendTextMessage('Untuk memesan silahkan ketik nama produk, jumlah dan satuannya atau silahkan memilih produk di bawah ini')

    retailerData = JSON.parse(retailerData)

    app.log("retailerData start show product", retailerData);

    // let isHoliday = await app.executeFunction('checkHoliday', { retailData: retailerData })
    // if (isHoliday) {
    //     // app.sendTextMessage("TESTRETAILER HOLIDAY");
    //     app.delayedMessage({ code: 'welcome-viber' }, {}, 200)
    //     return
    // }

    // //Is within general operational hour
    // const isOperationalHour = await app.executeFunction('checkGeneralOperationalHour')
    // if (!isOperationalHour) {
    //     // app.sendTextMessage("TESTRETAILER checkGeneralOperationalHour");
    //     // app.delayedMessage({ code: 'welcome-viber' }, {}, 200)
    //     return
    // }

    // //Is within retail available operational hour
    // let isRetailOperationalTime = await app.executeFunction('checkRetailOperationalHour', { retailData: retailerData })
    // if (!isRetailOperationalTime) {
    //     // app.sendTextMessage("TESTRETAILER CHECKOPERATIOANL");
    //     app.delayedMessage({ code: 'welcome-viber' }, {}, 200)
    //     // app.delayedMessage({ code: 'not-available', title: "Test oprational hour" }, {}, 200)
    //     return
    // }

    let arrRegionsAvailable = [];
    let retailersAllRegionByPhone = await getRetailersByPhone(retailerData.phone);

    for (const retail of retailersAllRegionByPhone) {
        arrRegionsAvailable.push(retail._source.region);
    }
    app.log("arrRegionsAvailable Start", arrRegionsAvailable);

    let dateNow = app.moment().add(7, 'hours').format('DD/MM/YYYY HH:mm:ss');

    for (const retail of retailersAllRegionByPhone) {
        let isRetailOperationalTime = await app.executeFunction('checkRetailOperationalHour', { retailData: retail._source });
        await app.log(retail._source.region + " isRetailOperationalTime - " + isRetailOperationalTime);

        if (!isRetailOperationalTime) {
            arrRegionsAvailable = arrRegionsAvailable.filter(item => item !== retail._source.region);
            retailersAllRegionByPhone = retailersAllRegionByPhone.filter(obj => obj._source.region !== retail._source.region);
        }
    }
    app.log("arrRegionsAvailable Check Time avail", arrRegionsAvailable);
    app.log("retailersAllRegionByPhone Time avail", retailersAllRegionByPhone.length);

    // app.sendTextMessage("arrRegionsAvailable CekJamOpr ==>" + arrRegionsAvailable.toString());

    if (retailersAllRegionByPhone.length <= 0) {
        app.delayedMessage({ code: 'not-available', title: app.profile.payload == 'en' ? 'You cannot place an order at this time, please come back at the time the order has been determined for you by scanning the same QR code! 😀🙏' : 'Anda tidak dapat melakukan pemesanan untuk saat ini, silahkan kembali lagi di waktu order yang telah ditentukan untuk Anda dengan scan QR code yang sama ya! 😀🙏' }, {}, 0)
        app.executeFunction('disableDelayedMessage');
        return resolve();
    }

    let firstPrior = {
        region: "",
        store_code: ""
    }
    for (const retail of retailersAllRegionByPhone) {
        await app.log(retail._source.region + " REGION ");
        // let isHoliday = await getHolidaysByRegion(reg, app.moment().add(7, 'hours').format('YYYY-MM-DD'));
        if (retail._source.priority == 1) {
            firstPrior.region = retail._source.region;
            firstPrior.store_code = retail._source.store_code;
        }
        let delivDate = app.moment().add(7, 'hours').format('YYYY-MM-DD');
        if (app.profile.deliveryOption == "nextday") {
            // jktMoment = app.moment().add(7, 'hours').add(1, 'days');

            let deliveryByDay = await getDayFromDb(retail._source);
            deliveryByDay = parseInt(deliveryByDay) ? parseInt(deliveryByDay) : 1;

            delivDate = app.moment().add(7, 'hours').add(deliveryByDay, 'day').format('YYYY-MM-DD');
        }

        let isHoliday = await getHolidaysByRegion(retail._source.region, delivDate);

        await app.log(retail._source.region + " isHoliday - " + isHoliday);

        if (isHoliday) {
            arrRegionsAvailable = arrRegionsAvailable.filter(item => item !== retail._source.region);
            retailersAllRegionByPhone = retailersAllRegionByPhone.filter(obj => obj._source.region !== retail._source.region);
        }
    }

    // app.sendTextMessage("arrRegionsAvailable (not holiday) ==>" + arrRegionsAvailable.toString());

    app.log("arrRegionsAvailable Check available (not holiday)", arrRegionsAvailable);
    app.log("retailersAllRegionByPhone Check available (not holiday)", retailersAllRegionByPhone.length);
    if (retailersAllRegionByPhone.length <= 0) {
        await app.executeFunction('showConfiguredImage', {
            type: 'holiday',
            region: firstPrior.region,
            store_code: firstPrior.store_code
        });
        app.sendTextMessage("Maaf, untuk pengiriman " + app.profile.deliveryOption +" kami sedang tutup karena hari libur dan tidak ada pengiriman. Silahkan kembali lagi pada jadwal berikutnya")
        app.delayedMessage({ code: 'welcome-viber' }, {}, 200)
        return;
    }

    // for (const retail of retailersAllRegionByPhone) {
    //     let isRetailOperationalTime = await app.executeFunction('checkRetailOperationalHour', { retailData: retail._source });
    //     await app.log(retail._source.region + " isRetailOperationalTime - " + isRetailOperationalTime);

    //     if (!isRetailOperationalTime) {
    //         arrRegionsAvailable = arrRegionsAvailable.filter(item => item !== retail._source.region);
    //         retailersAllRegionByPhone = retailersAllRegionByPhone.filter(obj => obj._source.region !== retail._source.region);
    //     }
    // }
    // app.log("arrRegionsAvailable Check Time avail", arrRegionsAvailable);
    // app.log("retailersAllRegionByPhone Time avail", retailersAllRegionByPhone.length);
    // if (retailersAllRegionByPhone.length <= 0) {
    //     app.sendTextMessage("Maaf, untuk pengiriman " + app.profile.deliveryOption +", Anda tidak dapat melakukan pemesanan untuk saat ini, silahkan kembali lagi di waktu order yang telah ditentukan untuk Anda dengan scan QR code yang sama ya! 😀🙏")
    //     app.delayedMessage({ code: 'welcome-viber' }, {}, 200)
    //     return;
    // }




    //Check if max order is already reached between retailer or region
    const isMaxOrderReached = await app.executeFunction('isMaxOrderReachedNew', { retailersAllRegionByPhone: retailersAllRegionByPhone }).catch((err) => {
        app.log(err, "err in isMaxOrderReached")
        app.log({ isMaxOrderReached });
        app.datastore.insert({
            table: 'max_order_reached_logs',
            record: {
                uid: app.sender,
                region: retailerData.region,
                phone: retailerData.phone,
                result: JSON.stringify(err)
            }
        });
        return null
    });

    app.log("SKIIPPmaxorde", isMaxOrderReached);
    retailerData = await getRetailersDetail(isMaxOrderReached.retailer_data.phone, isMaxOrderReached.retailer_data.priority);
    app.datastore.insert({
        table: 'max_order_reached_logs',
        record: {
            uid: app.sender,
            region: retailerData.region,
            phone: retailerData.phone,
            result: JSON.stringify(isMaxOrderReached)
        }
    });
    if (!isMaxOrderReached || (isMaxOrderReached && isMaxOrderReached.limit)) {
        if (isMaxOrderReached && isMaxOrderReached.limit && isMaxOrderReached.reason === 'retail-limit-reached') {
            let gap_name = isMaxOrderReached.gap_name === 'day' ? 'hari' : isMaxOrderReached.gap_name === 'week' ? 'minggu' : isMaxOrderReached.gap_name === 'month' ? 'bulan' : 'tahun'
            // Sriram
            if (app.profile.payload == 'en' || retailerData.language == "en") {
                gap_name = isMaxOrderReached.gap_name
            }

            if (app.profile.deliveryOption == "sameday") {
                app.sendTextMessage("Mohon Maaf, Anda telah mencapai batas maksimal pemesanan untuk pengiriman hari ini. Silahkan pilih opsi pengiriman besok untuk melanjutkan");

                app.profile.isSwitchDelivery = true;
                app.updateProfile();
                app.delayedMessage({ "code": 'choose-delivery-option' }, {}, 500);
                return;
            }
            app.delayedMessage({ code: 'not-available', title: app.profile.payload == "en" || retailerData.language == "en" ? `You have reached the maximum order limit for ${isMaxOrderReached.gap_count} ${gap_name}, please order again the next ${gap_name}! Thank you` : `Anda telah mencapai batas maksimal pemesanan untuk ${isMaxOrderReached.gap_count} ${gap_name} ini, silahkan order kembali di ${gap_name} selanjutnya! Terima Kasih` }, {}, 0)
            // await app.sendTextMessage(`Anda telah mencapai batas maksimal pemesanan untuk ${isMaxOrderReached.gap_count} ${gap_name} ini, silahkan order kembali di ${gap_name} selanjutnya! Terima Kasih`);
        } else {
            if (app.profile.deliveryOption == "sameday") {
                app.sendTextMessage("Mohon Maaf, Anda telah mencapai batas maksimal pemesanan untuk pengiriman hari ini. Silahkan pilih opsi pengiriman besok untuk melanjutkan");

                app.profile.isSwitchDelivery = true;
                app.updateProfile();
                app.delayedMessage({ "code": 'choose-delivery-option' }, {}, 500)
                return;
            }

            // Sriram
            app.delayedMessage({ code: 'not-available', title: app.profile.payload == "en" || retailerData.language == "en" ? `Orders are full for today, please order again the next day! Thank You` : 'Pesanan telah penuh untuk hari ini, Silahkan order kembali di hari selanjutnya ! Terima Kasih' }, {}, 0)
            // await app.sendTextMessage('Pesanan telah penuh untuk hari ini, Silahkan order kembali di hari selanjutnya ! Terima Kasih');
        }
        return;
    }

    const isMaxCashLimitReached = await app.executeFunction('isMaxCashLimitReached', { retailerData });
    if (isMaxCashLimitReached) {
        // app.sendTextMessage("TESTRETAILER isMaxCashLimitReached");
        app.delayedMessage({ code: 'welcome-viber' }, {}, 200)
        return;
    }
    //////
    //////END OF NEW CODE

    // setTimeout(() => {
    //     app.sendTextMessage("promptShowProduct -> " + retailerData.region);
    // }, 200);


    await collectProducts(retailerData.region);
    let packageItems = await collectPackages(retailerData.region);

    try {

        let wrongRemoveStatus = await wrongRemove()
        let hideItems = [];
        await app.executeFunction('updateEndSession');
        if (packageItems) {
            packageItems.hits.hits.forEach(item => {
                if (item._source.hide == 1) {
                    hideItems.push(item._source.sku_id);
                }
            });
        }

        let cards = [];
        let carts = await getCartQuantity();
        await app.executeFunction("updateSkuCountLogs", { sku_added_to_cart: carts.length || 0 });
        let userHasCarts = carts && carts.length ? true : false
        let products = await getProduct(carts, retailerData);
        if (hideItems.length) {
            products = await products.filter(product => !hideItems.includes(product.sku_id));
        }
        app.log(products.length, '==========PRODUCT ARRAY=======')
        if (products && products.length) {

            products.forEach((product) => {
                // let minPurchase = 0
                // if (product.min_allocation && !isNaN(product.min_allocation) && product.min_allocation > 0){
                //     minPurchase = product.min_allocation
                // }
                let image = product.image ? product.image.split(',')[0] : 'https://cdn.yellowmessenger.com/wkoiPLe9DBu81650431575535.jpg';
                let imageHeight = product.image ? product.image.split(',')[1] ? product.image.split(',')[1].trim() + "px" : "200px" : "200px";
                let imageWidth = product.image ? product.image.split(',')[2] ? product.image.split(',')[2].trim() + "px" : "100px" : "100px";
                let descriptions = processString(product.description);
                let unitName = descriptions.stringsOutsideBrackets[0] ? descriptions.stringsOutsideBrackets[0] : "";
                let extraTitle = descriptions.stringsInsideBrackets[0] ? descriptions.stringsInsideBrackets[0] : "";
                let card = {
                    title: extraTitle ? `<strong style="color:red">[${extraTitle}]</strong> ` + product.name : product.name, //product.item_name,
                    text: app.profile.payload == 'en' || retailerData.language == "en" ? `Price: ${formatter.format(product.unit_price).split(',')[0]}` : `Harga: ${formatter.format(product.unit_price).split(',')[0]}`,
                    image: image,
                    imageHeight: imageHeight,
                    imageWidth: imageWidth,
                    // input: [{ type: "number", text: "Jumlah (dalam bungkus)", min: 0, max: 100, itemCount: product.itemCount }],
                    input: [{ type: "number", text: app.profile.payload == 'en' || retailerData.language == "en" ? `Quantity (in pack)` : unitName ? `Jumlah (dalam ${unitName})` : "Jumlah (dalam bungkus)", min: 0, max: 1000000000000, itemCount: product.itemCount }],
                    actions: [{
                        title: app.profile.payload == 'en' || retailerData.language == "en" ? "Add to Cart 🛒" : "Tambahkan ke Keranjang 🛒",
                        text: JSON.stringify({ type: 'product', code: product.sku_id, name: product.name, image: product.image, offers: product.offering && offering && product.offering.toLowerCase() == "true" ? true : false }),
                        sendEvent: "get-selected-item"
                    }]
                }

                cards.push(card);

            });
        }

        if (app.data.event && app.data.event.offering && !cards.length) {
            // app.sendTextMessage('GENERATE ORDER')
            app.executeFunction('generateOrder')
            return;
        } else if (app.data.event && app.data.event.offering && cards.length) {
            app.profile.showOfferingDate = app.moment().add(7, 'hours').format("DD-MM-YYYY");
            app.updateProfile();
            // await app.executeFunction('showConfiguredImage', {
            //     type: 'closing',
            //     region: retailerData.region
            // });
            // await app.executeFunction('showConfiguredVideo', {
            //     type: 'closing',
            //     region: retailerData.region
            // });
            let availableOfferingItem = products.find(product => parseInt(product.itemCount) > 0) ? true : false;
            if (cards.length != 1) {
                if (app.profile.payload == "en" || retailerData.language == "en") {
                    availableOfferingItem ? app.sendTextMessage("Would you like to add following products?") : app.sendTextMessage("Would you like to add following products?")
                } else {
                    availableOfferingItem ? app.sendTextMessage("Apakah Anda mau menambah jumlah produk berikut?") : app.sendTextMessage("Anda bisa juga menambahkan produk di bawah ini.")
                }

            } else {
                if (app.profile.payload == "en" || retailerData.language == "en") {
                    availableOfferingItem ? app.sendTextMessage(`Would you like to add following ${cards[0].title} products?`) : app.sendTextMessage(`Would you like to add ${cards[0].title}?`)
                } else {
                    availableOfferingItem ? app.sendTextMessage(`Apakah Anda mau menambah jumlah produk ${cards[0].title} berikut?`) : app.sendTextMessage(`Anda bisa juga menambahkan produk ${cards[0].title} di bawah ini.`)
                }

            }
        }


        let rawcode = [];
        carts.map(data => {
            rawcode.push(data.code);
        });

        app.log(app.profile.userAgent, "--BROWSER--")

        app.memory.get('cart_logs').then(cartLogs => {
            cartLogs = JSON.parse(cartLogs);

            cartLogs = cartLogs.filter(item => !rawcode.includes(item.code));

            let logs = [...carts, ...cartLogs]
            app.log(logs, 'CART LOGS')
            app.executeFunction('updateCartLogs', { logs, first: false })
            app.memory.set('cart_logs', logs)
        }).catch(err => {
            let logs = [...carts]
            app.log(logs, 'CART LOGS')
            app.executeFunction('updateCartLogs', { logs, first: true })
            app.memory.set('cart_logs', logs)
        });

        let noRes = onSearch && subFamily ? 'Mohon maaf, belum ada product yang terdaftar untuk etalase yang Anda pilih' : 'Nama produk yang anda cari tidak sesuai, cari produk lain yuk! 😄'
        let message = wrongRemoveStatus ? '' : products && products.length && onSearch ? 'Berikut adalah hasil dari pencarian produk Anda 😁' : onSearch ? noRes : ''
        if (app.profile.payload == "en" || retailerData.language == "en") {
            noRes = onSearch && subFamily ? 'Sorry, but there are no products listed for the storefront you have selected' : `The product name you are looking for does not match, let's find another product! 😄`
            message = wrongRemoveStatus ? '' : products && products.length && onSearch ? 'Here are the results of your product search 😁' : onSearch ? noRes : ''
        }

        let productFamily = app.data.event && app.data.event.offering ? [] : await getProductFamily(retailerData);
        let productFamilyCards = await getProductFamily(retailerData);
        // let productFamilyCarousel = await getProductFamily(retailerData);
        if (app.data.event && app.data.event.offering) {
            productFamily.push({
                title: app.profile.payload == "en" || retailerData.language == "en" ? "My Cart 🛒" : "Lihat Keranjang 🛒",
                text: "cart-summary",
                backgroundColor: "#09ac52",
                textColor: "#FFFFFF"
            });
        } else {
            productFamily.push({
                title: app.profile.payload == "en" || retailerData.language == "en" ? "My Cart 🛒" : "Lihat Keranjang 🛒",
                text: "cart-summary",
                backgroundColor: "#09ac52",
                textColor: "#FFFFFF"
            });
            // productFamily.push({
            //     title: "Lihat Keranjang 🛒",
            //     text: "cart-summary",
            //     backgroundColor: "#0070C0",
            //     textColor: "#FFFFFF"
            // });
        }

        if (app.data.event && app.data.event.offering) {
            productFamily.push({
                title: app.profile.payload == "en" || retailerData.language == "en" ? "Checkout Order" : "Selesaikan Pesanan",
                text: "checkout",
                backgroundColor: "#0070C0",
                textColor: "#FFFFFF"
            });
        } else {
            productFamily.push({
                title: app.profile.payload == "en" || retailerData.language == "en" ? "Re-order" : "Pesan Kembali",
                text: "reorder-history",
                backgroundColor: "#0070C0",
                textColor: "#FFFFFF"
            });

            productFamily.push({
                title: app.profile.payload == "en" || retailerData.language == "en" ? "Order History" : "Riwayat Pesanan",
                text: "order-history",
                backgroundColor: "#0070C0",
                textColor: "#FFFFFF"
            });
        }

        // if (!app.data.event.offering) {
        //     await app.sendTextMessage(`Dengan menggunakan CITA berarti Anda sudah menyetujui <a href="https://www.pmiprivacy.com/indonesia/id/business-partner/" target="_blank"><u>Syarat dan Ketentuan</u></a> yg berlaku`)
        // }

        // app.sendTextMessage(cards.length)


        // app.log(productFamily, 'PRODUCT FAMILY')
        if (message) {
            app.sendTextMessage(message).then(() => {
                if (products && products.length && onSearch) {
                    app.sendTextMessage(app.profile.payload == "en" || retailerData.language == "en" ? 'To order, please enter product name, quantity, and unit. You can also select the product below.' : 'Untuk memesan silahkan ketik nama produk, jumlah dan satuannya atau silahkan memilih produk di bawah ini')
                }
                setTimeout(() => {
                    // for (let i=0;i<cards.length;i=i+2) {
                    //     let show = [];
                    //     if (cards[i]) {
                    //         show.push(cards[i])
                    //     }
                    //     if (cards[i+1]) {
                    //         show.push(cards[i+1])
                    //     }
                    //     await app.sendCards(show)
                    // }
                    app.sendCards(cards)
                        .then(async () => {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            // await app.sendCards(productFamilyCarousel)
                            let title = app.profile.payload == "en" || retailerData.language == "en" ? "You can select from the product family below. When you're done, select 'My Cart' to continue the order." : "Setelah menambahkan produk, Anda bisa melanjutkan berbelanja dengan memilih produk family yang lain atau pilih Lihat Keranjang untuk melanjutkan proses pemesanan"
                            app.sendQuickReplies({
                                title: title, //app.data.event && app.data.event.offering ? `Dengan menyelesaikan pesanan ini berarti Anda sudah menyetujui <a href="https://www.pmiprivacy.com/indonesia/id/business-partner/" target="_blank"><u>Syarat dan Ketentuan<u/></a> yg berlaku` : title,
                                options: productFamily
                            })
                                .then(() => { return resolve() })
                                .catch(e => app.log(e, 'err in app.sendQuickRepies - promptShowProduct'))

                        })
                        .catch(e => app.log(e, 'err in app.sendCards - promptShowProduct'));
                }, 300)

            })
        } else {
            setTimeout(() => {
                // for (let i = 0; i < cards.length; i = i + 2) {
                //     let show = [];
                //     if (cards[i]) {
                //         show.push(cards[i])
                //     }
                //     if (cards[i + 1]) {
                //         show.push(cards[i + 1])
                //     }
                //     await app.sendCards(show)
                // }
                //app.sendCards(cards)
                app.sendWebView('', `https://yellowario.github.io/cita-webview/`, 700, { fullWidthWidget: false, scrollable: true, fixedPosition: false, id: 'webviewId' })
                    .then(async () => {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        // await app.sendCards(productFamilyCarousel)
                        let title = app.profile.payload == "en" || retailerData.language == "en" ? "You can select from the product family below. When you're done, select 'My Cart' to continue the order." : "Setelah menambahkan produk, Anda bisa melanjutkan berbelanja dengan memilih produk family yang lain atau pilih Lihat Keranjang untuk melanjutkan proses pemesanan"
                        // app.sendCards(productFamilyCards).then(async () => {

                        //     app.sendQuickReplies({
                        //         title: title, //app.data.event && app.data.event.offering ? `Dengan menyelesaikan pesanan ini berarti Anda sudah menyetujui <a href="https://www.pmiprivacy.com/indonesia/id/business-partner/" target="_blank"><u>Syarat dan Ketentuan</u></a> yg berlaku` : title,
                        //         options: productFamily
                        //     })
                        //         .then(() => { return resolve() })
                        //         .catch(e => app.log(e, 'err in app.sendQuickRepies - promptShowProduct'))
                        // })
                        app.sendQuickReplies({
                            title: title, //app.data.event && app.data.event.offering ? `Dengan menyelesaikan pesanan ini berarti Anda sudah menyetujui <a href="https://www.pmiprivacy.com/indonesia/id/business-partner/" target="_blank"><u>Syarat dan Ketentuan</u></a> yg berlaku` : title,
                            options: productFamily
                        })
                            .then(() => { return resolve() })
                            .catch(e => app.log(e, 'err in app.sendQuickRepies - promptShowProduct'))

                    })
                    .catch(e => app.log(e, 'err in app.sendCards - promptShowProduct'));
            }, 500)

        }
        // app.log(products, '=====');

    } catch (e) {
        app.log(e, 'err in promptShowProduct')
    }

});

