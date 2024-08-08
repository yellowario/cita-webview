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

const collectProducts = async (region) => {
    app.log(`=======IN COLLECT PRODUCT ${region}=======`)
    let body = {
        query: {
            "bool": {
                "must": [{ "match_phrase": { "region": region } }],
                "must_not": [{ "match_phrase": { "stocks": 0 } }, { "match_phrase": { "stick": 0 } }]
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
        return JSON.stringify(packageItems);
    } else {
        app.memory.set('package_items', null);
        return null
    }
}

function removeSpecialChar(words) {
    let separate = words.split(', ').join('|').split(',')
    separate = separate.filter(x => x)
    return separate.join('|').split('+').join(' ').split('(').join('').split(')').join('')
}

function recognizeRemove(word, entities) {
    let regex = new RegExp(`${entities}`, 'g');
    // app.log(entities.length, 'RECOG REMOVE')
    if (entities.length ? word.match(regex) : false) {
        return word.replace(regex, '').replace(/^\s+|\s+$/g, '').replace(/\s\s+/g, ' ');
    } else {
        return false
    }
}

function removePretext(word, questionMark) {
    let pretextEntities = [];
    if (app.prediction.entities.pretext) {
        app.prediction.entities.pretext.map(data => {
            // if (data.match_string != 'tidak' && questionMark) {
            pretextEntities.push(data.match_string + ' ');
            pretextEntities.push(' ' + data.match_string);
            // }
        });
        pretextEntities = pretextEntities.sort((a, b) => b.length - a.length).join('|');
        // app.log({ pretextEntities, word }, 'PRETEXT ENTITIES')
        let regex = new RegExp(`${pretextEntities}|[?]`, 'g');
        return word.replace(regex, '').replace(/^\s+|\s+$/g, '').replace(/\s\s+/g, ' ');
    } else {
        return word
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

async function getSimilarity(products, search) {
    let data = [];
    await products.map(product => {
        let aliases = product.aliases.replace(/[' ']/g, '').split(',');
        let sim = 0;
        aliases.forEach(alias => {
            let simil = similarity(alias, search.replace(/[' ']/g, ''))
            simil > sim ? sim = simil : sim;
        })

        data.push({ ...product, similarity: sim });
        // product.similarity = sim;
    });
    let maxSim = Math.max(...data.map(x => x.similarity));
    // app.log(maxSim, 'MAX SIMILARITY')
    let result = maxSim > 0.5 ? data.filter(x => {
        return x.similarity == maxSim
        // return x.similarity >= maxSim - (maxSim * 0.1)
    }) : [];
    return result;
}

const updateCartLog = (carts) => {
    let rawcode = [];
    carts.map(data => {
        rawcode.push(data.code);
    });

    app.memory.get('cart_logs').then(cartLogs => {
        cartLogs = JSON.parse(cartLogs);

        cartLogs = cartLogs.filter(item => !rawcode.includes(item.code));

        let logs = [...carts, ...cartLogs]
        // app.log(logs, 'CART LOGS')
        app.executeFunction('updateCartLogs', { logs, first: false })
        app.memory.set('cart_logs', logs)
    }).catch(err => {
        let logs = [...carts]
        // app.log(logs, 'CART LOGS')
        app.executeFunction('updateCartLogs', { logs, first: true })
        app.memory.set('cart_logs', logs)
    });
}

const getProduct = async (skuId, retailerData) => {
    let body = {
        query: {
            "bool": {
                "must": [
                    { "match_phrase": { "region": retailerData.region } },
                    { "match_phrase": { "sku_id": skuId } }
                ],
                "must_not": [{ "match_phrase": { "stocks": 0 } }]
            }
        },
        size: 5000
    }
    let productDb = await app.dataStore.search({
        table: `products`,
        body: body
    }).catch(() => {
        app.executeFunction('insertDatabaseQueryTime', {
            table: 'products',
            query: body,
            error: true
        });
        app.log("====Failed search in products=====");
        return null
    })

    if (productDb) {
        app.executeFunction('insertDatabaseQueryTime', {
            table: 'products',
            query: body,
            took: productDb.took,
            length: productDb.hits.hits.length
        });
        const productMatchRegion = productDb.hits.hits.find((data) => data._source.region.toLowerCase() === retailerData.region.toLowerCase())
        if (productMatchRegion) {
            return productMatchRegion._source
        }
    }

    return null
}

const inputOrder = async (carts, product, qty, retailerData) => {
    let mandatoryProducts = await app.memory.get('mandatory-products').catch(() => { return null })
    if (mandatoryProducts) {
        mandatoryProducts = JSON.parse(mandatoryProducts)
    }
    // app.context.steps.showProduct = 'cart-summary';
    // app.log({ product, qty }, '==== inputOrder');

    // Modify BENY
    let productDetail = await getProduct(product.code, retailerData);
    let offers = product.offers ? true : false;
    // let minimumSkuPurchase = await app.executeFunction('getMinimumProductPurchase', { skuId: product.code, retailerData: retailerData })
    // if (qty !== 0 && qty < minimumSkuPurchase) {
    //     app.sendTextMessage("Maaf, minimal pemesanan untuk produk " + product.name + " adalah " + minimumSkuPurchase + " bungkus.");
    //     app.delayedMessage({ "code": 'show-product' }, {}, 0);
    //     return
    // }
    // app.log(retailerData, '========RETAILER DATA=========')
    let packages = await app.memory.get('package_items').catch(err => { return "null" })
    let remainingProductAllocation = await app.executeFunction('getRemainingMaxProductAllocation', { skuId: product.code, retailerData: retailerData, qty, carts, packages });
    app.log(remainingProductAllocation, "remainingProductAllocation ==>")
    let isMaxCashLimitReached = await app.executeFunction('isMaxCashLimitReached', { skuId: product.code, retailerData, qty, carts });
    // await app.log(remainingProductAllocation, "remainingProductAllocation");

    if (isMaxCashLimitReached) {
        app.sendTextMessage(app.profile.payload == "en" || retailerData.language == "en" ? "Sorry, you cannot add " + product.name + " to your shopping cart because it has already exceeded your maximum daily cost" : "Maaf, Anda tidak dapat menambahkan " + product.name + " pada keranjang belanja Anda karena sudah melebihi biaya maksimal harian Anda");
        app.delayedMessage({ "code": 'show-product' }, {}, 0);
        return "yes"
    }

    if (remainingProductAllocation < qty) {
        qty = remainingProductAllocation;
        // app.sendTextMessage("Mohon maaf untuk produk " + product.name + " memiliki batas pesanan sebanyak " + productDb.max_allocation + " per hari untuk setiap toko. Toko Anda hari ini telah memesan sebanyak " + (productDb.max_allocation - remainingProductAllocation) + " dan kami hanya bisa menambah pesanan Toko Anda untuk produk " + product.name + " ini dengan sisa batas yang masih tersedia. Silahkan periksa kembali pesanan Anda dibawah ini.");
        if (qty < 1) {
            app.sendTextMessage(app.profile.payload == 'en' || retailerData.language == "en" ? "Sorry, you cannot add " + product.name + " to your shopping cart because the product has reached the maximum daily order limit " : "Maaf, Anda tidak dapat menambahkan " + product.name + " pada keranjang belanja Anda karena produk tersebut telah mencapai batas maksimum pemesanan harian ");
            app.delayedMessage({ "code": 'show-cart' }, {}, 0);
            return "yes";
        } else {
            app.sendTextMessage(app.profile.payload == "en" || retailerData.language == "en" ? "Sorry, the maximum daily limit for the order " + product.name + " is " + remainingProductAllocation + " pack(s), we will make adjustments for the amount of " + product.name + " in your shopping cart" : "Maaf, batas maksimum harian untuk order " + product.name + " adalah " + remainingProductAllocation + " bungkus, kami akan melakukan penyesuaian untuk jumlah " + product.name + " pada keranjang belanja Anda");
            app.delayedMessage({ "code": 'show-product' }, {}, 0);
        }

        // app.delayedMessage({ "code": 'show-cart' }, {}, 0);
        // return "yes";
    }

    const productPrice = await productDetail.unit_price;
    if (carts.length > 0) {
        if (qty > 0) {
            if (mandatoryProducts && mandatoryProducts.length) {
                const isProductMandatory = mandatoryProducts.find(mandatory => mandatory.sku === product.code)
                if (isProductMandatory) {
                    if (qty < isProductMandatory.qty) {
                        qty = isProductMandatory.qty
                    }
                }
            }

            const currentItem = carts.findIndex(item => item.code == product.code);

            if (currentItem != -1) {
                carts[currentItem].quantity = qty;
                carts[currentItem].price = productPrice;
                carts[currentItem].source = 'carousel';
                carts[currentItem].offers = offers;
            } else {
                product.quantity = qty;
                product.price = productPrice;
                product.source = 'carousel';
                product.offers = offers;
                carts.unshift(product);
            }
            app.memory.set('carts', carts, 8640000);
            await app.executeFunction("updateSkuCountLogs", { sku_added_to_cart: carts.length || 0 });
            updateCartLog(carts);

        } else {
            //Deleting the item
            if (mandatoryProducts && mandatoryProducts.length) {
                const isProductMandatory = mandatoryProducts.find(mandatory => mandatory.sku === product.code)
                if (isProductMandatory) {
                    app.sendTextMessage(app.profile.payload == "en" || retailerData.language == "en" ? `You may not remove ${product.name} from your cart.` : `Anda tidak boleh menghapus ${product.name} dari keranjang Anda.`)
                    app.memory.set('carts', carts, 8640000);
                    updateCartLog(carts);
                    app.delayedMessage({ "code": 'show-product' }, {}, 500);
                    return "yes";
                }
            }

            carts = carts.filter(item => item.code != product.code);

            app.memory.set('carts', carts, 8640000);
            updateCartLog(carts);
            await app.executeFunction("updateSkuCountLogs", { sku_added_to_cart: carts.length || 0 });
            return "yes";
        }
    } else {
        if (qty > 0) {
            let carts = [];
            if (mandatoryProducts && mandatoryProducts.length) {
                const isProductMandatory = mandatoryProducts.find(mandatory => mandatory.sku === product.code)
                if (isProductMandatory) {
                    if (qty < isProductMandatory.qty) {
                        qty = isProductMandatory.qty
                    }
                }
            }
            product.quantity = qty;
            product.price = productPrice;
            product.source = 'carousel';
            product.offers = offers;
            carts.push(product);
            app.memory.set('carts', carts, 8640000);
            updateCartLog(carts);
            await app.executeFunction("updateSkuCountLogs", { sku_added_to_cart: carts.length || 0 });
            return "yes";
        }
    }
    return "yes";
}

const mergeCart = async (carts, products, retailerData) => {
    let mandatoryProducts = await app.memory.get('mandatory-products').catch(() => { return null })

    if (mandatoryProducts) {
        mandatoryProducts = JSON.parse(mandatoryProducts)
    }

    let text = [];
    let mandatoryText = [];
    let codes = [];
    let removetxt = [];

    app.log(products, 'producst CART before addd');

    for (let i = 0; i < products.length; i++) {
        // Modify BENY
        // app.log(retailerData, '==== retailerData');

        //Check if product is removed from cart
        if (products[i].remove || products[i].quantity == 0) {
            //Check if removed product is a mandatory product
            if (mandatoryProducts && mandatoryProducts.length) {
                const isProductMandatory = mandatoryProducts.find(mandatory => mandatory.sku === products[i].code)
                if (isProductMandatory) {
                    mandatoryText.push(app.profile.payload == "en" || retailerData.language == "en" ? `You may not remove ${products[i].name} from your cart.` : `Anda tidak boleh menghapus ${products[i].name} dari keranjang Anda.`)
                    continue;
                }
            }
            let idx = carts.findIndex(x => x.code == products[i].code);
            if (idx > -1) {
                carts.splice(idx, 1);
                removetxt.push(`❌ ${products[i].name}`)
            }
        } else { //Check if new product is added or updated
            //Check if added or updated product is mandatory product
            if (mandatoryProducts && mandatoryProducts.length) {
                const isProductMandatory = mandatoryProducts.find(mandatory => mandatory.sku === products[i].code)
                if (isProductMandatory) {
                    codes.push(products[i].code)
                    if (products[i].quantity < isProductMandatory.qty) {
                        products[i].quantity = isProductMandatory.qty
                        mandatoryText.push(app.profile.payload == "en" || retailerData.language == "en" ? `Purchase of product ${products[i].name} has been adjusted with a minimum purchase of ${products[i].quantity} pack(s)` : `Pembelian produk ${products[i].name} telah disesuaikan dengan minimal pembelian sebanyak ${products[i].quantity} bungkus`)
                    }
                    // text.push(`✅ ${products[i].name} sebanyak ${products[i].quantity} bungkus`)
                    // codes.push(products[i].code)
                    // continue;
                }
            }

            //Check if added product quantity is more than that minimum product purchase
            // let minimumSkuPurchase = await app.executeFunction('getMinimumProductPurchase', { skuId: products[i].code, retailerData: retailerData })
            // if (products[i].quantity !== 0 && products[i].quantity < minimumSkuPurchase) {
            //     codes.push(products[i].code)
            //     text.push(`✅ ${products[i].name} sebanyak ${minimumSkuPurchase} bungkus`)
            //     mandatoryText.push(`Pembelian produk ${products[i].name} telah disesuaikan dengan minimal pembelian sebanyak ${minimumSkuPurchase} bungkus`)
            //     products[i].quantity = minimumSkuPurchase
            //     continue;
            // }

            //Check if added product has reach maximum order at that day
            let remainingProductAllocation = await app.executeFunction('getRemainingMaxProductAllocation', { skuId: products[i].code, retailerData: retailerData, carts });
            let isMaxCashLimitReached = await app.executeFunction('isMaxCashLimitReached', { skuId: products[i].code, retailerData, qty: products[i].quantity, carts });
            if (isMaxCashLimitReached) {
                app.sendTextMessage(app.profile.payload == "en" || retailerData.language == "en" ? "Sorry, you cannot add " + products[i].name + " to your shopping cart because it has already exceeded your maximum daily cost" : "Maaf, Anda tidak dapat menambahkan " + products[i].name + " pada keranjang belanja Anda karena sudah melebihi biaya maksimal harian Anda");
                products.splice(i, 1);
                continue;
            }

            if (remainingProductAllocation < products[i].quantity) {
                if (remainingProductAllocation < 1) {
                    app.sendTextMessage(app.profile.payload == "en" || retailerData.language == "en" ? "Sorry, you cannot add " + products[i].name + " to your shopping cart because the product has reached the maximum daily order limit" : "Maaf, Anda tidak dapat menambahkan " + products[i].name + " pada keranjang belanja Anda kerena produk tersebut telah mencapai batas maksimum pemesanan harian ");
                    products.splice(i, 1);
                    continue;
                }

                products[i].quantity = remainingProductAllocation;
                app.sendTextMessage(app.profile.payload == "en" || retailerData.language == "en" ? "Sorry, the maximum daily limit for the order " + products[i].name + " is " + remainingProductAllocation + " wrap, we will make adjustments for the amount of " + products[i].name + " in your shopping cart" : "Maaf, batas maksimum harian untuk order " + products[i].name + " adalah " + remainingProductAllocation + " bungkus, kami akan melakukan penyesuaian untuk jumlah " + products[i].name + " pada keranjang belanja Anda");
                codes.push(products[i].code)
                continue;
            }
            codes.push(products[i].code)
            text.push(app.profile.payload == "en" || retailerData.language == "en" ? `✅ ${products[i].name} ${products[i].quantity} pack(s)` : `✅ ${products[i].name} sebanyak ${products[i].quantity} bungkus`)
        }
    }

    products = products.filter(x => !x.remove);
    if (text.length) {
        text = text.join('\n') + (app.profile.payload == "en" || retailerData.language == "en" ? '\n<strong>Successfully added to cart</strong>' : '\n<strong>Berhasil ditambahkan ke keranjang</strong>')
    }
    if (removetxt.length) {
        text = text.length ? text + '\n\n' + removetxt.join('\n') + '\n<strong>Berhasil dihapus dari keranjang</strong>' : removetxt.join('\n') + '\n<strong>Berhasil dihapus dari keranjang</strong>'
        if (app.profile.payload == "en" || retailerData.language == "en") {
            text = text.length ? text + '\n\n' + removetxt.join('\n') + '\n<strong>Successfully removed from cart</strong>' : removetxt.join('\n') + '\n<strong>Successfully removed from cart</strong>'
        }
    }
    if (mandatoryText.length) {
        text = app.profile.payload == "en" || retailerData.language == "en" ? text.length ? text + '\n\Notes:\n\n' + mandatoryText.join('\n') : mandatoryText.join('\n') : text.length ? text + '\n\nCatatan:\n\n' + mandatoryText.join('\n') : mandatoryText.join('\n')
    }

    carts = carts.filter(item => !codes.includes(item.code));
    // app.log(carts, 'CLEAN CARTS')

    carts = [...products, ...carts];
    // app.log(carts, 'MERGE CART')
    app.memory.set('carts', carts, 8640000);
    await app.executeFunction("updateSkuCountLogs", { sku_added_to_cart: carts.length || 0 });
    return text

}

const getCarts = async () => {
    try {
        let carts = await app.memory.get('carts');
        return JSON.parse(carts);
    } catch (err) {
        app.log(err);
        return [];
    }
}


return new Promise(async (resolve, reject) => {
    // Your logic goes here
    // app.log('VALIDATOR SHOW PRODUCT');

    //////////NEW CODE BY EGRI
    /////////
    //Is user validated?
    let retailerData = await app.memory.get('retailer_data').catch(() => { return null })
    if (!retailerData) {
        app.memory.delete('carts')
        app.delayedMessage({ code: 'welcome-viber' }, {}, 200)
        return
    }
    retailerData = JSON.parse(retailerData)
    //Is within general operational hour
    // const isOperationalHour = await app.executeFunction('checkGeneralOperationalHour')
    // if (!isOperationalHour) {
    //     app.memory.delete('carts')
    //     // Sriram
    //     app.delayedMessage({ code: 'not-available', title: app.profile.payload == "en" || retailerData.language == "en" ? 'Sorry, the time to order has expired. Please return to shopping at the appointed time! 😀🙏' : 'Mohon maaf waktu untuk memesan telah berakhir. Silahkan kembali berbelanja diwaktu yang telah ditentukan! 😀🙏' }, {}, 0)

    //     //app.sendTextMessage('Mohon maaf waktu untuk memesan telah berakhir. Silahkan kembali berbelanja diwaktu yang telah ditentukan! 😀🙏')
    //     return
    // }
    // //Is within retail available operational hour
    // let isRetailOperationalTime = await app.executeFunction('checkRetailOperationalHour', { retailData: retailerData })
    // if (!isRetailOperationalTime) {
    //     app.memory.delete('carts')
    //     // Sriram
    //     app.delayedMessage({ code: 'not-available', title: app.profile.payload == "en" || retailerData.language == "en" ? 'Sorry, the time to order has expired. Please return to shopping at the appointed time! 😀🙏' : 'Mohon maaf waktu untuk memesan telah berakhir. Silahkan kembali berbelanja diwaktu yang telah ditentukan! 😀🙏' }, {}, 0)

    //     // app.sendTextMessage('Mohon maaf waktu untuk memesan telah berakhir. Silahkan kembali berbelanja diwaktu yang telah ditentukan! 😀🙏')
    //     return
    // }


    let arrRegionsAvailable = [];
    let retailersAllRegionByPhone = await getRetailersByPhone(retailerData.phone);

    for (const retail of retailersAllRegionByPhone) {
        arrRegionsAvailable.push(retail._source.region);
    }
    app.log("arrRegionsAvailable Start", arrRegionsAvailable);

    let firstPrior = { region: "", store_code: "" };
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
    app.log("arrRegionsAvailable Check available (not holiday)", arrRegionsAvailable);
    app.log("retailersAllRegionByPhone Check available (not holiday)", retailersAllRegionByPhone.length);
    if (retailersAllRegionByPhone.length <= 0) {
        await app.executeFunction('showConfiguredImage', {
            type: 'holiday',
            region: firstPrior.region,
            store_code: firstPrior.store_code
        });
        app.sendTextMessage("Maaf, untuk pengiriman " + app.profile.deliveryOption + " kami sedang tutup karena hari libur dan tidak ada pengiriman. Silahkan kembali lagi pada jadwal berikutnya")
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
    //     app.sendTextMessage("Maaf, untuk pengiriman " + app.profile.deliveryOption + ", Anda tidak dapat melakukan pemesanan untuk saat ini, silahkan kembali lagi di waktu order yang telah ditentukan untuk Anda dengan scan QR code yang sama ya! 😀🙏")
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

            app.delayedMessage({ code: 'not-available', title: app.profile.payload == "en" || retailerData.language == "en" ? `You have reached the maximum order limit for this ${isMaxOrderReached.gap_count} ${gap_name}, please order again at the next ${gap_name}! Thank you` : `Anda telah mencapai batas maksimal pemesanan untuk ${isMaxOrderReached.gap_count} ${gap_name} ini, silahkan order kembali di ${gap_name} selanjutnya! Terima Kasih` }, {}, 0)

            //await app.sendTextMessage(`Anda telah mencapai batas maksimal pemesanan untuk ${isMaxOrderReached.gap_count} ${gap_name} ini, silahkan order kembali di ${gap_name} selanjutnya! Terima Kasih`);
        } else {
            if (app.profile.deliveryOption == "sameday") {
                app.sendTextMessage("Mohon Maaf, Anda telah mencapai batas maksimal pemesanan untuk pengiriman hari ini. Silahkan pilih opsi pengiriman besok untuk melanjutkan");

                app.profile.isSwitchDelivery = true;
                app.updateProfile();
                app.delayedMessage({ "code": 'choose-delivery-option' }, {}, 500);
                return;
            }

            // Sriram
            app.delayedMessage({ code: 'not-available', title: app.profile.payload == "en" || retailerData.language == "en" ? 'Orders are full for today, please order again the next day! Thank You' : 'Pesanan telah penuh untuk hari ini, Silahkan order kembali di hari selanjutnya ! Terima Kasih' }, {}, 0)

            // await app.sendTextMessage('Pesanan telah penuh untuk hari ini, Silahkan order kembali di hari selanjutnya ! Terima Kasih');
        }
        return;
    }
    //////
    //////END OF NEW CODE


    let result = await app.memory.get('products');
    result = JSON.parse(result);
    let carts = await getCarts();
    let codes = carts.map(cart => cart.code);
    let cartres = result.filter(r => codes.includes(r.sku_id));

    let action = app.data.message;
    let productFamily = await app.memory.get('product-family').catch(() => { return null })
    if (productFamily) {
        productFamily = JSON.parse(productFamily)
    }
    // app.log(productFamily, 'PRODUCT FAMILY')
    if (action == 'cart-summary') {
        // prevent NLP
        // await collectProducts(retailerData.region);
        // await collectPackages(retailerData.region);
        return app.delayedMessage({ "code": 'show-cart' }, {}, 0);
        // return resolve()

    }
    else if (action == 'order-history') {
        return app.delayedMessage({ "code": 'order-history' }, {}, 0);
        // return resolve()

    }
    else if (action == 'reorder-history') {
        return app.delayedMessage({ "code": 'reorder' }, {}, 0);
    }
    else if (action == 'checkout') {
        // // --START - CHECK PROMO--
        // let promoData = await app.memory.get("promo_data").catch(() => { })
        // promoData = JSON.parse(promoData)
        // if (promoData) {
        //     return app.executeFunction("addPromoProductToCart", { promo_items: promoData.promo_items });
        // }
        // // --END - CHECK PROMO--
        app.log("Coming to trigger generateOrder");
        app.executeFunction('generateOrder');
        return;
    }
    else if ((action && action.startsWith('/')) && productFamily && productFamily.length > 0) {
        let productFamilyMatch = await productFamily.find((productFamily) => productFamily.text === action)
        if (productFamilyMatch) {
            // app.log(productFamilyMatch, 'PRODUCT FAMILY MATCH')
            return app.delayedMessage({ "code": 'show-product', subfamily: productFamilyMatch.originalText }, {}, 0);
            // return resolve();
        }
    }
    else if (app.data && app.data.event && app.data.event) {
        // app.log("DDDDDDDDDDDDDDDDDDDDDDDD")
        app.log(app.data.event, "===========event running=============")
        let keysDescription = Object.keys(app.data.event.payload)[0];
        app.log({ keysDescription })
        const qty = Math.abs(app.data.event.payload[keysDescription]);
        // const qty = parseInt(app.data.event.payload[keysDescription]);
        // const qty = parseInt(app.data.event.payload['Jumlah (dalam bungkus) :']) || parseInt(app.data.event.payload['Quantity (in a pack) :']);
        const product = JSON.parse(app.data.event.textData);
        await inputOrder(carts, product, qty, retailerData);
        return reject();
    } else {
        // app.log("EEEEEEEEEEEEEEEEEEEEEEEe")
        let questionMark = app.data.message ? app.data.message.endsWith('?') : false;
        let removeSpecial = removeSpecialChar(app.prediction.text);
        // app.log(app.prediction.text, 'REMOVE SPECIAL')
        let freeSearch = await removePretext(removeSpecial, questionMark)
        let search = app.data.message.length > 1 ? freeSearch : '~~~';
        // app.log(search, 'SEARCH FOR')

        let freetext = await removePretext(app.prediction.text.toLowerCase(), questionMark);
        // app.log(freetext, 'FREETEXT')
        let searches = app.data.message.length > 2 ? freetext.split(/[,.&]|\\bdan\\b|\\band\\b/i).join('|').split(',').join('|').split('|') : [];
        searches = searches.filter(x => x)
        // app.log(searches, 'SEARCH ARRAY')

        let productList = []
        let body = {
            "query": {
                "bool": {
                    "must": [
                        { "match_phrase": { "region": retailerData.region } },
                        { "match": { "aliases": search } }
                    ],
                    "must_not": [{ "match_phrase": { "stocks": 0 } }]
                }
            },
            size: 1
        }
        const db = await app.dataStore.search({
            table: `products`,
            body: body
        }).catch(() => {
            app.executeFunction('insertDatabaseQueryTime', {
                table: 'products',
                query: body,
                error: true
            });
            app.log("====Failed search in products=====");
            return null
        });
        // app.log(db, '=====DB======')
        if (db) {
            app.executeFunction('insertDatabaseQueryTime', {
                table: 'products',
                query: body,
                took: db.took,
                length: db.hits.hits.length
            });
        }

        if (db && db.hits.hits.length) {
            db.hits.hits.forEach((product) => {
                if (product._source.region.toLowerCase() === retailerData.region.toLowerCase()) {
                    productList.push(product._source)
                }
            })
        }

        let searching = [];
        let products = [];

        //!!!!!BEWARE, IN CASE SHIT HAPPEN, JUST UNCOMMENT LINE 587 & 788 - 791
        // app.log(productList.length, 'DB LENGTH')
        // if (productList.length == 0) {
        let removeText = [];

        let removeEntities = [];
        if (app.prediction.entities.remove) {
            await app.prediction.entities.remove.map(data => {
                removeEntities.push(data.match_string)
            });
            removeEntities = removeEntities.join('|');
            // app.log(removeEntities, 'REMOVE ENTITIES')
        }


        if (app.prediction.entities.unit_name) {
            let unitEntities = [];
            await app.prediction.entities.unit_name.map(data => {
                unitEntities.push({
                    text: data.match_string,
                    value: data.value
                });
            });

            // app.log(unitEntities, 'UNIT ENTITIES')

            for (let i = 0; i < searches.length; i++) {
                let data = searches[i]
                let remove = await recognizeRemove(data, removeEntities);
                let search = data.split(' ');
                search = ['dan', 'juga', 'jg', 'n'].includes(search[0]) ? search.slice(1) : search;
                let unitName = search.pop().toLowerCase();
                let qty = search.pop();
                let product = search.join(' ').toLowerCase();
                let unitData = unitEntities.filter(unit => unit.text.toLowerCase() == unitName)

                if (unitData.length && (unitData[0].text == "pack" || unitData[0].text == "pak")) {
                    unitData[0].value = "bungkus"
                }

                // app.log({ unitName, qty, product, unitData, remove }, 'UNIT NAME')
                if (!isNaN(qty) && unitData.length && remove == false) {
                    // app.log('CEK DISINI')
                    let filter = result.filter(data => data.aliases.toLowerCase().includes(product));
                    if (filter.length == 0) {
                        filter = await getSimilarity(result, product)
                    }
                    // app.log({ product, filter: filter.length }, 'PRODUCT SEARCH');
                    if (filter.length == 1 && !questionMark) {
                        let indexProduct = products.findIndex(item => item.code == filter[0].sku_id)
                        let oldQty = indexProduct > -1 ? products[indexProduct].quantity : 0;
                        if (indexProduct > -1) { products.splice(indexProduct, 1) }
                        // products = products.filter(item => item.code != filter[0].sku_id);
                        const conversionQty = await app.executeFunction('unitConversion', { unit: unitData[0].value, sku: filter[0].sku_id, qty: qty, region: retailerData.region })
                        products.push({
                            name: filter[0].name,
                            code: filter[0].sku_id,
                            image: filter[0].image,
                            price: filter[0].unit_price,
                            quantity: Math.abs(oldQty + conversionQty),
                            source: 'freetext'
                        });
                        app.log(products, 'PRODUCTS*****')
                    } else {
                        searching.push(product);
                    }
                } else if (!isNaN(unitName) && remove == false) {
                    product = product + ' ' + qty;
                    // let _qty = parseInt(unitName);
                    let _qty = Math.abs(unitName);
                    let filter = result.filter(data => data.aliases.toLowerCase().includes(product));
                    if (filter.length == 0) {
                        filter = await getSimilarity(result, product)
                    }
                    // app.log({ product, filter: filter.length }, 'PRODUCT SEARCH');
                    if (filter.length == 1 && !questionMark) {
                        let indexProduct = products.findIndex(item => item.code == filter[0].sku_id)
                        let oldQty = indexProduct > -1 ? products[indexProduct].quantity : 0;
                        if (indexProduct > -1) { products.splice(indexProduct, 1) }
                        // products = products.filter(item => item.code != filter[0].sku_id);
                        products.push({
                            name: filter[0].name,
                            code: filter[0].sku_id,
                            image: filter[0].image,
                            price: filter[0].unit_price,
                            quantity: Math.abs(oldQty + _qty),
                            source: 'freetext'
                        });
                    } else {
                        searching.push(product);
                    }
                } else if (remove) {
                    let filter = cartres.filter(data => data.aliases.toLowerCase().includes(remove));
                    if (filter.length == 0) {
                        filter = await getSimilarity(cartres, remove)
                    }
                    if (filter.length == 1 && !questionMark) {
                        products.push({
                            name: filter[0].name,
                            code: filter[0].sku_id,
                            image: filter[0].image,
                            price: filter[0].unit_price,
                            quantity: 0,
                            source: 'freetext',
                            remove: true
                        });
                        // app.log(products, 'PRODUCTS*****')
                    } else {
                        removeText.push(app.profile.payload == "en" || retailerData.language == "en" ? `Sorry, the product "${remove}" you want to delete is unknown or not specific` : `Maaf produk "${remove}" yang anda ingin hapus tidak diketahui atau kurang spesifik`)
                    }
                }
            }

        } else {
            await searches.map(async data => {
                let remove = recognizeRemove(data, removeEntities);
                let search = data.split(' ');
                search = ['dan', 'juga', 'jg', 'n'].includes(search[0]) ? search.slice(1) : search;
                let qty = search.pop();
                let product = search.join(' ').toLowerCase();
                // app.log({ qty, product, remove }, 'WO UNIT NAME')
                if (remove) {
                    let filter = cartres.filter(data => data.aliases.toLowerCase().includes(remove));
                    if (filter.length == 0) {
                        filter = await getSimilarity(cartres, remove)
                    }
                    if (filter.length == 1 && !questionMark) {
                        products.push({
                            name: filter[0].name,
                            code: filter[0].sku_id,
                            image: filter[0].image,
                            price: filter[0].unit_price,
                            quantity: 0,
                            source: 'freetext',
                            remove: true
                        });
                        // app.log(products, 'PRODUCTS*****')
                    } else {
                        removeText.push(app.profile.payload == "en" || retailerData.language == "en" ? `Sorry, the product "${remove}" you want to delete is unknown or not specific` : `Maaf produk "${remove}" yang anda ingin hapus tidak diketahui atau kurang spesifik`)
                    }
                } else if (!isNaN(qty)) {
                    let filter = result.filter(data => data.aliases.toLowerCase().includes(product));
                    if (filter.length == 0) {
                        filter = await getSimilarity(result, product)
                    }
                    // app.log({ product, filter: filter.length }, 'PRODUCT SEARCH');

                    if (filter.length == 1 && !questionMark) {
                        let indexProduct = products.findIndex(item => item.code == filter[0].sku_id)
                        let oldQty = indexProduct > -1 ? products[indexProduct].quantity : 0;
                        if (indexProduct > -1) { products.splice(indexProduct, 1) }
                        // products = products.filter(item => item.code != filter[0].sku_id);
                        products.push({
                            name: filter[0].name,
                            code: filter[0].sku_id,
                            image: filter[0].image,
                            price: filter[0].unit_price,
                            // quantity: isNaN(qty) ? 0 + oldQty : parseInt(qty) + oldQty,
                            quantity: isNaN(qty) ? 0 + oldQty : Math.abs(qty) + oldQty,
                            source: 'freetext'
                        });
                    } else {
                        searching.push(product);
                    }
                }
            });

        }

        setTimeout(async () => {
            if (removeText.length) {
                let msg = []
                removeText.forEach(rt => !rt.toLowerCase().includes('maaf') ? msg.push('- ' + rt) : msg.push(rt));
                app.sendTextMessage(msg.join('\n'))
            }
            app.log(products, '=PRODUCT IN TIMEOUT HIT=')
            if (products.length) {
                app.log('cart-summary HIT')

                let text = await mergeCart(carts, products, retailerData);
                app.sendTextMessage(text)
                if (searching.length) {
                    app.log('AAAAAAAAAAAAAAAAAAAAAAaa')
                    app.delayedMessage({ "code": 'show-product', search: searching.join('|') }, {}, 0);
                    return resolve();
                } else {
                    app.log('sssssssss')
                    app.delayedMessage({ "code": 'show-cart' }, {}, 0);
                    return resolve();
                }

            } else {
                // app.log('dor')
                if (searching.length) {
                    app.log(searching, '=PRODUCT SEARCH IN TIMEOUT HIT=')
                    app.delayedMessage({ "code": 'show-product', search: searching.join('|') }, {}, 0);
                    return resolve();
                } else {
                    app.log(search, '=SEARCH IN TIMEOUT HIT=')
                    if (questionMark) {
                        app.delayedMessage({ code: 'general-question' }, {}, 0);
                    } else {
                        app.delayedMessage({ "code": 'show-product', search }, {}, 0);
                    }
                    return resolve();
                }

            }
        }, 0)

        // } else {
        //     app.delayedMessage({ "code": 'show-product', search }, {}, 0);
        //     return resolve();
        // }
    }
});