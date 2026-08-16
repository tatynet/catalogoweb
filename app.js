document.addEventListener('DOMContentLoaded', () => {
    const productsGrid = document.getElementById('productsGrid');
    const searchInput = document.getElementById('searchInput');
    const categoryFilters = document.getElementById('categoryFilters');
    const categorySearchInput = document.getElementById('categorySearchInput');
    const clearSearchBtn = document.getElementById('clearSearch');
    const cartToggle = document.getElementById('cartToggle');
    const themeToggle = document.getElementById('themeToggle');
    
    // Elementos del carrito
    const cartOverlay = document.getElementById('cartOverlay');
    const cartSidebar = document.getElementById('cartSidebar');
    const closeCartBtn = document.getElementById('closeCart');
    const cartItemsContainer = document.getElementById('cartItems');
    const cartTotalValue = document.getElementById('cartTotalValue');
    const cartBadge = document.getElementById('cartBadge');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    // Elementos del formulario del cliente
    const customerName = document.getElementById('customerName');
    const customerID = document.getElementById('customerID');
    const customerPhone = document.getElementById('customerPhone');
    const customerAddress = document.getElementById('customerAddress');

    // Cargar datos guardados del cliente (Autocompletar)
    if (customerName) customerName.value = localStorage.getItem('tatynet_name') || '';
    if (customerID) customerID.value = localStorage.getItem('tatynet_id') || '';
    if (customerPhone) customerPhone.value = localStorage.getItem('tatynet_phone') || '';
    
    // Mejoras UX
    const toast = document.getElementById('toast');
    const floatingWhatsApp = document.getElementById('floatingWhatsApp');
    const floatingCartBtn = document.getElementById('floatingCartBtn');
    const floatingCartBadge = document.getElementById('floatingCartBadge');

    // Alert Modal
    const alertModal = document.getElementById('alertModal');
    const alertModalMessage = document.getElementById('alertModalMessage');
    const closeAlertBtn = document.getElementById('closeAlertBtn');

    function showAlert(message) {
        if (alertModalMessage && alertModal) {
            alertModalMessage.textContent = message;
            alertModal.classList.add('active');
        } else {
            alert(message);
        }
    }

    if (closeAlertBtn && alertModal) {
        closeAlertBtn.addEventListener('click', () => {
            alertModal.classList.remove('active');
        });
        alertModal.addEventListener('click', (e) => {
            if (e.target === alertModal) {
                alertModal.classList.remove('active');
            }
        });
    }

    let allProducts = [];
    let currentFilteredProducts = [];
    let combosMixtos = [];
    let configData = {};
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let newProductCodes = new Set(); // Códigos de productos detectados como nuevos
    
    // Variables para Paginación (Mejora de rendimiento para >500 productos)
    let currentPage = 1;
    const itemsPerPage = 24;

    // --- 1. Lógica del Modo Claro/Oscuro ---
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon(currentTheme);

    themeToggle.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        let newTheme = theme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });

    function updateThemeIcon(theme) {
        const icon = themeToggle.querySelector('i');
        if (theme === 'dark') {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }

    // --- Botón limpiar búsqueda ---
    if (searchInput && clearSearchBtn) {
        searchInput.addEventListener('input', () => {
            clearSearchBtn.style.display = searchInput.value.length > 0 ? 'flex' : 'none';
        });
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearSearchBtn.style.display = 'none';
            searchInput.dispatchEvent(new Event('input'));
            searchInput.focus();

            // UX: Scroll suave a los productos tras limpiar
            const productsSection = document.getElementById('productsGrid');
            if (productsSection) {
                const top = productsSection.getBoundingClientRect().top + window.scrollY - 120;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    }

    // --- Reset general al hacer clic en el logo ---
    const mainLogo = document.getElementById('mainLogo');
    if (mainLogo) {
        mainLogo.style.cursor = 'pointer';
        mainLogo.addEventListener('click', () => {
            // Limpiar búsqueda
            if (searchInput) {
                searchInput.value = '';
                if (clearSearchBtn) clearSearchBtn.style.display = 'none';
            }
            // Limpiar filtro de categoría
            if (categorySearchInput) {
                categorySearchInput.value = '';
                categorySearchInput.dispatchEvent(new Event('input'));
            }
            // Seleccionar "Todos"
            const todosBtn = document.querySelector('.filter-btn[data-category="Todos"]');
            if (todosBtn) {
                todosBtn.click();
            }
            // Scroll hacia arriba
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // --- Botón de Volver Rápido ---
    const quickBackBtn = document.getElementById('quickBackBtn');
    if (quickBackBtn) {
        quickBackBtn.addEventListener('click', () => {
            const todosBtn = document.querySelector('.filter-btn[data-category="Todos"]');
            if (todosBtn) todosBtn.click();
        });
    }

    // --- 2. Carga de Datos desde JSON (Productos y Configuración) ---
    // Usamos getTime() para evitar que el navegador guarde los archivos en caché y siempre muestre los nuevos productos
    const cacheBuster = new Date().getTime();
    
    function getCategoriaConReglas(nombreProducto, reglas, originalCategory) {
        if (originalCategory && originalCategory.toUpperCase().includes('COMBO')) {
            return 'COMBOS PROMOCIÓN';
        }
        
        const nombreUpper = nombreProducto.toUpperCase();
        if (reglas && reglas.length > 0) {
            for (const regla of reglas) {
                if (regla.contiene && nombreUpper.includes(regla.contiene.toUpperCase())) {
                    return regla.categoria;
                }
            }
        }
        // Fallback: primera palabra del nombre
        let primeraPalabra = nombreProducto.trim().split(/\s+/)[0];
        return primeraPalabra.charAt(0).toUpperCase() + primeraPalabra.slice(1).toLowerCase();
    }

    // Agrupar los combos mixtos únicos (definidos en productos.json) junto con sus productos participantes
    function buildCombosMixtos(products) {
        const map = new Map();
        products.forEach(p => {
            (p.combos_mixtos || []).forEach(combo => {
                const key = String(combo.id);
                if (!map.has(key)) {
                    map.set(key, {
                        ...combo,
                        productos: []
                    });
                }
                // Evitar duplicar el mismo producto en el combo
                const target = map.get(key);
                if (!target.productos.some(pp => String(pp.id) === String(p.id))) {
                    target.productos.push(p);
                }
            });
        });
        return Array.from(map.values()).map(combo => {
            combo.productos.sort((a, b) => a.precio - b.precio);
            return combo;
        });
    }

    // Precio de referencia para mostrar en la tarjeta (combinación mínima)
    function getComboReferencePrice(combo) {
        const qty = typeof combo.cantidad_requerida === 'number' && combo.cantidad_requerida > 0 ? combo.cantidad_requerida : 1;
        let sum = 0;
        if (combo.exigir_productos_distintos) {
            const sliced = combo.productos.slice(0, qty);
            sum = sliced.reduce((acc, p) => acc + p.precio, 0);
        } else {
            for (let i = 0; i < qty; i++) {
                sum += (combo.productos[0] && combo.productos[0].precio) || 0;
            }
        }
        if (combo.tipo_descuento === 'PORCENTAJE') {
            sum = sum * (1 - (combo.descuento_porcentaje || 0) / 100);
        }
        return sum;
    }

    function isComboMixView() {
        const active = document.querySelector('#categoryFilters .filter-btn.active');
        return active && active.dataset.category === 'combos_mixtos';
    }

    Promise.all([
        fetch(`config.json?v=${cacheBuster}`).then(res => {
            if (!res.ok) throw new Error('No se pudo cargar config.json');
            return res.json();
        }),
        fetch(`productos.json?v=${cacheBuster}`).then(res => {
            if (!res.ok) throw new Error('No se pudo cargar productos.json');
            return res.json();
        }),
        fetch(`categorias_reglas.json?v=${cacheBuster}`).then(res => {
            if (!res.ok) return { reglas: [] }; // Si no existe el archivo, continúa sin reglas
            return res.json();
        }).catch(() => ({ reglas: [] }))
    ])
    .then(([config, products, reglasData]) => {
        configData = config;
        const reglasCategoria = reglasData.reglas || [];
        
        allProducts = products.map(product => {
            // Asignar categoría usando reglas; si no coincide, usa la primera palabra (fallback)
            const categoriaAsignada = getCategoriaConReglas(product.nombre, reglasCategoria, product.categoria);

            // Sanear ofertas: si "tiene_promocion" pero el objeto promocion esta vacio o sin precio,
            // NO es una oferta real (evita errores de render y productos fantasma en la pagina de Promociones).
            let tienePromoValida = product.tiene_promocion;
            let promoObj = product.promocion || {};
            if (tienePromoValida && (promoObj.precio_especial === undefined || promoObj.precio_especial === null || promoObj.precio_especial === '')) {
                tienePromoValida = false;
                promoObj = {};
            }

            return {
                ...product,
                tiene_promocion: tienePromoValida,
                promocion: promoObj,
                categoria_original: product.categoria,
                categoria: categoriaAsignada
            };
        });

        // Ordenar inicialmente todos los productos por precio de menor a mayor
        allProducts.sort((a, b) => a.precio - b.precio);
        currentFilteredProducts = allProducts.filter(p => !p.es_unidad_hija);

        // Agrupar los combos mixtos definidos en productos.json
        combosMixtos = buildCombosMixtos(allProducts);

        // --- Detectar productos nuevos con localStorage ---
        detectNewProducts(allProducts);

        // Actualizar el nombre de la tienda en el HTML usando la configuración
        if (configData.nombre_tienda) {
            document.title = configData.nombre_tienda;
            const logoText = document.querySelector('.logo-text');
            if (logoText) logoText.innerHTML = `${configData.nombre_tienda}`;
        }

        // Configurar botón flotante de WhatsApp
        if (configData.whatsapp) {
            floatingWhatsApp.href = `https://wa.me/${configData.whatsapp}?text=¡Hola! Necesito ayuda con los productos de ${configData.nombre_tienda || 'su catálogo'}.`;
        }

        // Inicializar modal de promociones
        initPromoModal(configData);

        const isSchoolList = document.getElementById('isSchoolList');
        if (isSchoolList) {
            isSchoolList.addEventListener('change', updateCartUI);
        }

        renderProducts(currentFilteredProducts, true);
        generateCategoryButtons(allProducts);
        updateCartUI();



        // Mostrar banner si hay productos nuevos
        if (newProductCodes.size > 0) {
            // Mostrar Badges de Marketing y Novedades
            const heroNewBadge = document.getElementById('heroNewBadge');
            if (heroNewBadge) {
                heroNewBadge.style.display = 'inline-block';
                heroNewBadge.addEventListener('click', () => {
                    const novBtn = document.querySelector('.filter-btn[data-category="novedades"]');
                    if (novBtn) {
                        novBtn.click();
                        // Scroll hacia la cuadrícula
                        window.scrollTo({top: document.querySelector('.main-search-section').offsetTop - 50, behavior: 'smooth'});
                    }
                });
            }

            const dailyUpdateBadge = document.getElementById('dailyUpdateBadge');
            if (dailyUpdateBadge) {
                dailyUpdateBadge.style.display = 'flex';
            }

            if (typeof showNewProductsBanner === 'function') {
                showNewProductsBanner(newProductCodes.size);
            }

            // Toast de actualización diaria (Aviso a los clientes)
            setTimeout(() => {
                showToast('<i class="fas fa-sync-alt fa-spin"></i> <b>¡Catálogo actualizado!</b><br><span style="font-size:0.85rem">Nuevos productos añadidos hoy.</span>');
            }, 1500);
        }
    })
    .catch(error => {
        console.error('Error cargando los archivos JSON:', error);
        productsGrid.innerHTML = `
            <div class="no-results">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #ef4444; margin-bottom: 1rem; display: block;"></i>
                No se pudieron cargar los datos.<br>
                <small>Asegúrate de ejecutar esto en un servidor local y que <b>productos.json</b> y <b>config.json</b> existan.</small>
            </div>`;
    });

    // Función para renderizar productos recomendados en el modal
    function renderRecommendedProducts(currentProduct) {
        const recommendedList = document.getElementById('recommendedList');
        const recommendedSection = document.getElementById('recommendedProductsSection');
        if (!recommendedList || !recommendedSection) return;

        // Filtrar productos de la misma categoría, excluyendo el actual
        let related = allProducts.filter(p => p.categoria === currentProduct.categoria && p.codigo !== currentProduct.codigo);
        
        // Mezclar aleatoriamente
        related.sort(() => 0.5 - Math.random());
        
        // Tomar hasta 4
        related = related.slice(0, 4);

        if (related.length === 0) {
            recommendedSection.style.display = 'none';
            return;
        }

        recommendedSection.style.display = 'block';
        recommendedList.innerHTML = '';

        related.forEach(p => {
            const card = document.createElement('div');
            card.className = 'mini-product-card';
            
            const pImg = p.imagen ? p.imagen : 'img/placeholder.png';
            
            // Check promo for price
            let finalPrice = p.precio;
            if (p.tiene_promocion && p.promocion) {
                finalPrice = p.promocion.precio_especial;
            } else if (configData.promocion_activa && configData.promociones) {
                const promo = configData.promociones.find(promoItem => String(promoItem.codigo_producto) === String(p.codigo) && promoItem.activa !== false);
                if (promo) {
                    finalPrice = promo.precio_promocional || p.precio;
                }
            }

            // Nombre en formato legible (primera letra de cada palabra en mayúscula)
            const nombreLegible = p.nombre.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

            card.innerHTML = `
                <img src="${pImg}" alt="${p.nombre}" loading="lazy">
                <span class="mini-product-name" title="${p.nombre}">${nombreLegible}</span>
                <span class="mini-product-price">$${finalPrice.toFixed(2)}</span>
            `;
            
            card.addEventListener('click', () => {
                // Actualizar el modal con el nuevo producto
                const expandedImg = document.getElementById('expandedImg');
                const nameEl = document.getElementById('expandedProductName');
                const codeEl = document.getElementById('expandedProductCode');
                const priceEl = document.getElementById('expandedProductPrice');
                const modalBuyBtn = document.getElementById('modalBuyBtn');
                if (expandedImg) expandedImg.src = pImg;
                if (nameEl) nameEl.textContent = nombreLegible;
                if (codeEl) codeEl.textContent = `CÓD: ${p.codigo}`;
                if (priceEl) priceEl.textContent = `$${finalPrice.toFixed(2)}`;
                if (modalBuyBtn) {
                    modalBuyBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> Añadir al carrito';
                    modalBuyBtn.style.background = '';
                    modalBuyBtn.onclick = () => {
                        handleAddToCartWithModal(p, (isNewItem) => {
                            if (isNewItem) {
                                modalBuyBtn.innerHTML = '<i class="fas fa-check"></i> ¡Añadido!';
                                modalBuyBtn.style.background = '#10b981';
                            } else {
                                modalBuyBtn.innerHTML = '<i class="fas fa-info-circle"></i> ¡Ya en carrito!';
                                modalBuyBtn.style.background = '#f59e0b';
                            }
                        });
                    };
                }
                
                // Actualizar recomendaciones recursivamente
                renderRecommendedProducts(p);

                // Scroll suave al inicio del modal para ver la imagen nueva
                const imageModal = document.getElementById('imageModal');
                if (imageModal) imageModal.querySelector('.image-modal-card')?.scrollTo({ top: 0, behavior: 'smooth' });
});

        recommendedList.appendChild(card);
        });
    }

    // Vista ampliada de la imagen de una variante (cartucheras, modelos, etc.)
    function openVariantImagePreview(variantLabel, imgSrc, product, price) {
        const imageModal = document.getElementById('imageModal');
        const expandedImg = document.getElementById('expandedImg');
        const nameEl = document.getElementById('expandedProductName');
        const codeEl = document.getElementById('expandedProductCode');
        const priceEl = document.getElementById('expandedProductPrice');
        const modalBuyBtn = document.getElementById('modalBuyBtn');
        const recommendedSection = document.getElementById('recommendedProductsSection');
        if (!imageModal || !expandedImg) return;

        expandedImg.src = imgSrc;
        if (nameEl) nameEl.textContent = `${product.nombre} — ${variantLabel}`;
        if (codeEl) codeEl.textContent = `CÓD: ${product.codigo}`;
        if (priceEl) priceEl.textContent = `$${(price || product.precio).toFixed(2)}`;
        // Vista de solo lectura: ocultar botón de compra y recomendados
        if (modalBuyBtn) modalBuyBtn.style.display = 'none';
        if (recommendedSection) recommendedSection.style.display = 'none';

        const watermarkEl = document.getElementById('expandedWatermark');
        if (watermarkEl) {
            const rRotate = Math.floor(Math.random() * 30) - 45;
            watermarkEl.textContent = configData.nombre_tienda || 'Tatynet';
            watermarkEl.style.transform = `translate(-50%, -50%) rotate(${rRotate}deg)`;
        }

        imageModal.classList.add('active');
    }

    function restoreImageModalDefaults() {
        const modalBuyBtn = document.getElementById('modalBuyBtn');
        const recommendedSection = document.getElementById('recommendedProductsSection');
        if (modalBuyBtn) modalBuyBtn.style.display = '';
        if (recommendedSection) recommendedSection.style.display = '';
    }

    // --- 4. Renderizado de Productos (Paginación tipo "Ver Más") ---
    function renderProducts(products, reset = true) {
        if (reset) {
            const hasCards = productsGrid.querySelector('.product-card');
            if (hasCards) {
                // Animación suave: fade-out → clear → fade-in
                productsGrid.classList.add('fading-out');
                setTimeout(() => {
                    productsGrid.classList.remove('fading-out');
                    productsGrid.innerHTML = '';
                    currentPage = 1;
                    _renderPage(products);
                }, 160);
                return;
            }
            productsGrid.innerHTML = '';
            currentPage = 1;
        }
        _renderPage(products);
    }

    function _renderPage(products) {
        if (products.length === 0) {
            productsGrid.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-box-open" style="font-size: 2rem; margin-bottom: 1rem; display: block; opacity: 0.5;"></i>
                    No se encontraron productos que coincidan con tu búsqueda.
                </div>`;
            return;
        }

        // Paginación
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const productsToRender = products.slice(startIndex, endIndex);

        // Encabezado de la vista "Combos Mix"
        if (isComboMixView() && !productsGrid.querySelector('.combo-mix-header')) {
            const hdr = document.createElement('div');
            hdr.className = 'combo-mix-header';
            hdr.innerHTML = `<div class="combo-mix-header-icon"><i class="fas fa-gift"></i></div>
                <div>
                    <span class="combo-mix-hot"><i class="fas fa-fire"></i> Oferta de temporada · Precios que enamoran</span>
                    <h2>Combos Mix <span class="combo-mix-gradient">¡Ahorra en grande!</span></h2>
                    <p>Arma tu combo como quieras y llévate más por menos. Descuentos reales, todo en un solo lugar. ¡Tu bolsillo lo va a agradecer!</p>
                </div>`;
            productsGrid.appendChild(hdr);
        }

        productsToRender.forEach((product, index) => {
            const card = document.createElement('div');
            card.classList.add('product-card');

            if (product.es_combo_cerrado) {
                card.classList.add('combo-card');
                card.style.animationDelay = `${(index % itemsPerPage) * 0.05}s`;
                
                const imgSrc = product.imagen ? product.imagen : 'https://placehold.co/400x400/eeeeee/999999?text=Sin+Imagen';
                
                let itemsHtml = '';
                if (product.productos_incluidos && product.productos_incluidos.length > 0) {
                    itemsHtml = '<div class="combo-items-list"><ul>' + product.productos_incluidos.map(item => `<li>${item}</li>`).join('') + '</ul></div>';
                }

                card.innerHTML = `
                    <div class="combo-badge"><i class="fas fa-gift"></i> COMBO ESPECIAL</div>
                    <div class="combo-banner-container">
                        <img src="${imgSrc}" alt="${product.nombre}" loading="lazy">
                        <div class="combo-overlay-text">${product.nombre}</div>
                    </div>
                    <div class="product-info" style="padding-top: 5px;">
                        <div class="product-title" style="font-size: 1.1rem; color: #8b5cf6;">${product.nombre}</div>
                        ${itemsHtml}
                        <div class="product-price" style="font-size: 1.3rem; margin-top: 10px;">$${product.precio.toFixed(2)}</div>
                        <button class="btn-buy" style="margin-top: 10px; width: 100%; background: linear-gradient(135deg, #8b5cf6, #c084fc);"><i class="fas fa-shopping-cart"></i> Añadir Combo</button>
                    </div>
                `;

                const bannerImg = card.querySelector('.combo-banner-container');
                const buyBtn = card.querySelector('.btn-buy');
                
                const addCombo = () => {
                    handleAddToCartWithModal(product, () => {
                        buyBtn.innerHTML = '<i class="fas fa-check"></i> ¡Añadido!';
                        buyBtn.style.background = '#10b981';
                        setTimeout(() => {
                            buyBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> Añadir Combo';
                            buyBtn.style.background = 'linear-gradient(135deg, #8b5cf6, #c084fc)';
                        }, 2000);
                    });
                };

                bannerImg.addEventListener('click', addCombo);
                buyBtn.addEventListener('click', addCombo);

                productsGrid.appendChild(card);
                return;
            }

            // Tarjeta de Combo Mix (construido a partir de productos.json)
            if (product.productos && Array.isArray(product.productos) && product.tipo_descuento) {
                _renderComboMixCard(product, productsGrid, index);
                return;
            }
            
            // Animación escalonada
            card.style.animationDelay = `${(index % itemsPerPage) * 0.05}s`;

            // Imagen con fallback por si no existe
            const imgSrc = product.imagen ? product.imagen : 'https://placehold.co/400x400/eeeeee/999999?text=Sin+Imagen';

            // Badge de producto nuevo
            const isNew = newProductCodes.has(String(product.codigo));
            const newBadgeHtml = isNew
                ? `<div class="badge-nuevo"><i class="fas fa-sparkles"></i> NUEVO</div>`
                : '';

            // Lógica de Promoción
            let finalPrice = product.precio;
            let promoBadge = '';
            let priceHtml = `<span>$</span>${product.precio.toFixed(2)}`;
            let esPack = false;

            // 1. Verificar promoción individual del producto (nueva lógica JSON)
            const promoTienePrecio = product.promocion && product.promocion.precio_especial !== undefined && product.promocion.precio_especial !== null && product.promocion.precio_especial !== '';
            if (product.tiene_promocion && product.promocion && promoTienePrecio) {
                const promo = product.promocion;
                const min = promo.cantidad_minima || 1;
                
                if (min > 1) {
                    promoBadge = `<div class="promo-badge-animated wholesale-badge"><i class="fas fa-layer-group"></i> MEGA OFERTA</div>`;
                    if (promo.tipo === 'PACK' || (promo.precio_especial > product.precio)) {
                        esPack = true;
                        priceHtml = `<div class="promo-wholesale-box">
                                        <span class="promo-normal-price">Normal: $${product.precio.toFixed(2)} c/u</span>
                                        <span class="promo-special-price"><i class="fas fa-gift"></i> Lleva ${min} por: <strong>$${promo.precio_especial.toFixed(2)}</strong></span>
                                     </div>`;
                    } else {
                        priceHtml = `<div class="promo-wholesale-box">
                                        <span class="promo-normal-price">Normal: $${product.precio.toFixed(2)} c/u</span>
                                        <span class="promo-special-price"><i class="fas fa-bolt"></i> Desde ${min} unid: <strong>$${promo.precio_especial.toFixed(2)} c/u</strong></span>
                                     </div>`;
                    }
                } else {
                    finalPrice = promo.precio_especial;
                    const discount = Math.round((1 - (finalPrice / product.precio)) * 100);
                    promoBadge = `<div class="promo-badge-animated discount-badge"><i class="fas fa-tag"></i> OFERTA</div>`;
                    priceHtml = `<div class="promo-discount-box">
                                    <div class="promo-price-wrapper">
                                        <span class="promo-old-price">$${product.precio.toFixed(2)}</span>
                                        <span class="promo-new-price">$${finalPrice.toFixed(2)}</span>
                                    </div>
                                    ${discount > 0 ? `<div class="promo-discount-tag">-${discount}% OFF</div>` : ''}
                                 </div>`;
                }
            } 
            // 2. Verificar promoción antigua de config.json
            else if (configData.promocion_activa && configData.promociones) {
                const promo = configData.promociones.find(p => String(p.codigo_producto) === String(product.codigo) && p.activa !== false);
                if (promo) {
                    if (promo.solo_lista) {
                        promoBadge = `<div class="promo-badge-animated list-badge"><i class="fas fa-list-check"></i> PROMO LISTA</div>`;
                        priceHtml = `<div class="promo-list-box">
                                        <span class="promo-regular-price">$${product.precio.toFixed(2)}</span>
                                        <span class="promo-list-price"><i class="fas fa-star"></i> Por lista: <strong>$${promo.precio_promocional.toFixed(2)}</strong></span>
                                     </div>`;
                    } else {
                        finalPrice = promo.precio_promocional || product.precio;
                        const discount = Math.round((1 - (finalPrice / product.precio)) * 100);
                        promoBadge = `<div class="promo-badge-animated discount-badge"><i class="fas fa-tag"></i> PROMO</div>`;
                        priceHtml = `<div class="promo-discount-box">
                                        <div class="promo-price-wrapper">
                                            <span class="promo-old-price">$${product.precio.toFixed(2)}</span>
                                            <span class="promo-new-price">$${finalPrice.toFixed(2)}</span>
                                        </div>
                                        ${discount > 0 ? `<div class="promo-discount-tag">-${discount}% OFF</div>` : ''}
                                     </div>`;
                    }
                }
            }

            let promoDescHtml = '';
            if (product.tiene_promocion && product.promocion && product.promocion.descripcion) {
                promoDescHtml = `<div style="font-size: 0.75rem; color: #10b981; font-weight: 600; margin-top: 4px; display: flex; align-items: center; gap: 4px; line-height: 1.1;"><i class="fas fa-info-circle"></i> ${product.promocion.descripcion}</div>`;
            } else if (configData.promocion_activa && configData.promociones) {
                const promo = configData.promociones.find(p => String(p.codigo_producto) === String(product.codigo) && p.activa !== false);
                if (promo && promo.descripcion) {
                    promoDescHtml = `<div style="font-size: 0.75rem; color: #10b981; font-weight: 600; margin-top: 4px; display: flex; align-items: center; gap: 4px; line-height: 1.1;"><i class="fas fa-info-circle"></i> ${promo.descripcion}</div>`;
                }
            }

            // Generar valores aleatorios para la marca de agua (anti-bot)
            const randomX = Math.floor(Math.random() * 20) - 10;
            const randomY = Math.floor(Math.random() * 20) - 10;
            const randomRotate = Math.floor(Math.random() * 15) - 35; // e.g. -35 to -20

            card.innerHTML = `
                <div class="product-image-container">
                    ${newBadgeHtml}
                    ${promoBadge}
                    <div class="watermark-overlay" style="transform: translate(calc(-50% + ${randomX}px), calc(-50% + ${randomY}px)) rotate(${randomRotate}deg);">${configData.nombre_tienda || 'Tatynet'}</div>
                    <span class="product-category">${product.categoria}</span>
                    <div class="zoom-indicator" title="Clic para ver detalles"><i class="fas fa-search-plus"></i></div>
                    <img src="${imgSrc}" loading="lazy" alt="${product.nombre}" class="product-image" onerror="this.onerror=null;this.src='https://placehold.co/400x400/eeeeee/999999?text=Sin+Imagen';">
                </div>
                <div class="product-info">
                    <h3 class="product-name" title="${product.nombre}">${product.nombre}</h3>
                    ${promoDescHtml}
                </div>
                <div class="product-footer">
                    <div class="product-price">${priceHtml}</div>
                    <div style="display:flex; flex-direction:column; gap:0.5rem; flex:1;">
                        <button class="btn-buy" aria-label="Comprar ${product.nombre}">
                            <i class="fas fa-shopping-bag"></i> Comprar
                        </button>
                        <button class="btn-ask" style="background:transparent; border:1px solid var(--text-secondary); color:var(--text-secondary); padding:0.4rem; border-radius:50px; font-size:0.8rem; cursor:pointer;" aria-label="Consultar por ${product.nombre}">
                            <i class="fab fa-whatsapp"></i> Consultar
                        </button>
                    </div>
                </div>
            `;
            
            // Promo Pack: la caja de oferta es clicable y abre el modal de packs
            if (esPack && !(product.variantes && product.variantes.length > 0) && !product.es_fraccionable) {
                const box = card.querySelector('.promo-wholesale-box');
                if (box) {
                    box.style.cursor = 'pointer';
                    box.title = 'Clic para elegir cuántos packs agregar';
                    box.addEventListener('click', (e) => {
                        e.stopPropagation();
                        abrirPackModalWeb(product);
                    });
                }
            }

            // Evento para visualizar la imagen en grande
            const imgContainerEl = card.querySelector('.product-image-container');
            imgContainerEl.style.cursor = 'zoom-in';
            imgContainerEl.addEventListener('click', () => {
                // Tracking para Google Analytics (Sin impacto en rendimiento)
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'view_item', {
                        item_id: product.codigo,
                        item_name: product.nombre,
                        item_category: product.categoria
                    });
                }
                
                // Si el producto tiene variantes, abrir directamente el modal de variantes
                if (product.variantes && product.variantes.length > 0 && !product.color_seleccionado) {
                    handleAddToCartWithModal(product);
                    return;
                }
                const imageModal = document.getElementById('imageModal');
                const expandedImg = document.getElementById('expandedImg');
                const nameEl = document.getElementById('expandedProductName');
                const codeEl = document.getElementById('expandedProductCode');
                const priceEl = document.getElementById('expandedProductPrice');
                const modalBuyBtn = document.getElementById('modalBuyBtn');
                if (imageModal && expandedImg) {
                    restoreImageModalDefaults();
                    expandedImg.src = imgSrc;
                    const nombreTitleCase = product.nombre.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                    if (nameEl) nameEl.textContent = nombreTitleCase;
                    if (codeEl) codeEl.textContent = `CÓD: ${product.codigo}`;
                    if (priceEl) priceEl.textContent = `$${finalPrice.toFixed(2)}`;
                    if (modalBuyBtn) {
                        modalBuyBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> Añadir al carrito';
                        modalBuyBtn.style.background = '';
                        modalBuyBtn.onclick = () => {
                            handleAddToCartWithModal(product, (isNewItem) => {
                                if (isNewItem) {
                                    modalBuyBtn.innerHTML = '<i class="fas fa-check"></i> ¡Añadido!';
                                    modalBuyBtn.style.background = '#10b981';
                                } else {
                                    modalBuyBtn.innerHTML = '<i class="fas fa-info-circle"></i> ¡Ya en carrito!';
                                    modalBuyBtn.style.background = '#f59e0b';
                                }
                            });
                        };
                    }
                    
                    const watermarkEl = document.getElementById('expandedWatermark');
                    if (watermarkEl) {
                        const rRotate = Math.floor(Math.random() * 30) - 45; // -45 a -15 grados
                        watermarkEl.textContent = configData.nombre_tienda || 'Tatynet';
                        watermarkEl.style.transform = `translate(-50%, -50%) rotate(${rRotate}deg)`;
                    }

                    // Llenar productos recomendados
                    renderRecommendedProducts(product);

                    imageModal.classList.add('active');
                }
            });


            // Evento para añadir al carrito
            const buyBtn = card.querySelector('.btn-buy');
            buyBtn.addEventListener('click', () => {
                // Promo Pack: abrir modal para elegir packs en vez de añadir 1 unidad
                if (esPack && !(product.variantes && product.variantes.length > 0) && !product.es_fraccionable) {
                    abrirPackModalWeb(product);
                    return;
                }
                const originalText = buyBtn.innerHTML;
                const originalBg = buyBtn.style.background;
                const originalColor = buyBtn.style.color;
                
                handleAddToCartWithModal(product, (isNewItem) => {
                    if (isNewItem) {
                        buyBtn.innerHTML = '<i class="fas fa-check"></i> ¡Añadido!';
                        buyBtn.style.background = '#10b981'; // Verde éxito
                    } else {
                        buyBtn.innerHTML = '<i class="fas fa-info-circle"></i> ¡Ya agregado!';
                        buyBtn.style.background = '#f59e0b'; // Naranja/Amarillo
                    }
                    buyBtn.style.color = 'white';
                    
                    setTimeout(() => {
                        buyBtn.innerHTML = originalText;
                        buyBtn.style.background = originalBg;
                        buyBtn.style.color = originalColor;
                    }, 2000);
                });
            });

            // Evento para consultar duda
            const askBtn = card.querySelector('.btn-ask');
            if (askBtn) {
                askBtn.addEventListener('click', () => {
                    const phoneNumber = configData.whatsapp || '1234567890';
                    const message = `¡Hola! Tengo una duda sobre el producto: *${product.nombre}* (CÓD: ${product.codigo}). ¿Me podrían ayudar?`;
                    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
                });
            }

            productsGrid.appendChild(card);
        });

        manageLoadMoreButton(products);
    }

    function _renderComboMixCard(combo, grid, index) {
        const card = document.createElement('div');
        card.classList.add('product-card', 'combo-card', 'combo-mix-card');
        card.style.animationDelay = `${(index % itemsPerPage) * 0.05}s`;

        const imgSrc = combo.imagen || 'https://placehold.co/400x400/8b5cf6/ffffff?text=COMBO';
        const req = combo.cantidad_requerida || 1;
        const isClosed = combo.tipo_descuento === 'PRECIO_FIJO';

        let priceInfo = '';
        if (isClosed) {
            const raw = combo.productos.reduce((s, p) => s + p.precio, 0);
            const savings = Math.max(0, raw - combo.precio_total);
            priceInfo = `<div class="combo-mix-price">Lleva ${req} x <strong>$${combo.precio_total.toFixed(2)}</strong></div>
                <div class="combo-mix-save"><i class="fas fa-piggy-bank"></i> ${savings > 0 ? `Ahorras <b>$${savings.toFixed(2)}</b> al llevarlo completo` : 'Precio súper especial, ¡no lo dejes pasar!'}</div>`;
        } else {
            const ref = getComboReferencePrice(combo);
            priceInfo = `<div class="combo-mix-price">Lleva ${req} - <strong>${combo.descuento_porcentaje || 0}% OFF</strong><br><span class="combo-mix-from">desde $${ref.toFixed(2)}</span></div>
                <div class="combo-mix-save"><i class="fas fa-bolt"></i> Elige tú mismo y paga menos al instante</div>`;
        }

        const productosHtml = combo.productos.map(p => `<li>${p.nombre} — <b>$${p.precio.toFixed(2)}</b></li>`).join('');
        const noteHtml = isClosed
            ? `<div class="combo-mix-note"><i class="fas fa-lock"></i> Combo cerrado: se añade todo de una vez</div>`
            : (combo.exigir_productos_distintos
                ? `<div class="combo-mix-note"><i class="fas fa-th-list"></i> Mezcla y elige los que quieras</div>`
                : '');
        const tagline = isClosed
            ? `<div class="combo-mix-tagline"><i class="fas fa-star"></i> El favorito de los estudiantes</div>`
            : `<div class="combo-mix-tagline"><i class="fas fa-hand-point-up"></i> Tú decides, tú ahorras</div>`;

        card.innerHTML = `
            <div class="combo-badge"><i class="fas fa-gift"></i> COMBO MIX</div>
            <div class="combo-banner-container combo-mix-banner">
                <img src="${imgSrc}" alt="${combo.nombre}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/400x400/8b5cf6/ffffff?text=Combo';">
                <div class="combo-overlay-text">${combo.nombre}</div>
            </div>
            <div class="product-info" style="padding-top: 5px;">
                ${tagline}
                <div class="combo-mix-title">${combo.nombre}</div>
                <div class="combo-mix-meta"><i class="fas fa-box"></i> ${req} producto${req !== 1 ? 's' : ''}</div>
                ${noteHtml}
                <div class="combo-items-list combo-mix-products"><ul>${productosHtml}</ul></div>
                ${priceInfo}
                <button class="btn-buy combo-mix-btn">
                    ${isClosed ? '<i class="fas fa-shopping-cart"></i> ¡Llévatelo!' : '<i class="fas fa-gift"></i> Armar mi Combo'}
                </button>
            </div>
        `;

        const buyBtn = card.querySelector('.combo-mix-btn');
        const banner = card.querySelector('.combo-banner-container');
        if (isClosed) {
            const closedHandler = () => addClosedComboToCart(combo, buyBtn);
            buyBtn.addEventListener('click', closedHandler);
            banner.addEventListener('click', () => addClosedComboToCart(combo));
        } else {
            buyBtn.addEventListener('click', () => openComboBuilder(combo));
            banner.addEventListener('click', () => openComboBuilder(combo));
        }

        grid.appendChild(card);
    }

    // Añade al carrito un combo cerrado (PRECIO_FIJO): sin selección, todo de una vez
    function addClosedComboToCart(combo, btn) {
        const items = combo.productos.map(p => ({ nombre: p.nombre, cantidad: 1, precio: p.precio, codigo: p.codigo }));
        const raw = combo.productos.reduce((s, p) => s + p.precio, 0);
        const comboItem = {
            id: `combo_mix_${combo.id}_${Date.now()}`,
            codigo: `COMBO${combo.id}`,
            nombre: `COMBO MIX: ${combo.nombre}`,
            imagen: combo.imagen,
            precio: combo.precio_total,
            quantity: 1,
            es_combo_mix: true,
            combo_items: items,
            _rawSum: raw
        };
        addToCart(comboItem);
        if (btn) {
            btn.innerHTML = '<i class="fas fa-check"></i> ¡En el carrito!';
            btn.style.background = '#10b981';
            setTimeout(() => {
                const isClosed = combo.tipo_descuento === 'PRECIO_FIJO';
                btn.innerHTML = isClosed ? '<i class="fas fa-shopping-cart"></i> ¡Llévatelo!' : '<i class="fas fa-gift"></i> Armar mi Combo';
                btn.style.background = 'linear-gradient(135deg, #8b5cf6, #c084fc)';
            }, 2000);
        }
    }

    function openComboBuilder(combo) {
        const modal = document.getElementById('comboModal');
        const nameEl = document.getElementById('comboModalName');
        const listEl = document.getElementById('comboProductsList');
        const summarySel = document.getElementById('comboSummarySelected');
        const summaryPrice = document.getElementById('comboSummaryPrice');
        const savingsHint = document.getElementById('comboSavingsHint');
        const addBtn = document.getElementById('comboAddBtn');
        if (!modal || !listEl || !combo.productos || combo.productos.length === 0) return;

        const req = combo.cantidad_requerida || 1;
        const selection = {};
        combo.productos.forEach(p => { selection[String(p.id)] = 0; });

        nameEl.textContent = combo.nombre;
        listEl.innerHTML = '';
        if (savingsHint) {
            savingsHint.innerHTML = '';
            savingsHint.className = 'combo-savings-hint';
        }

        const getSelectionSum = () => {
            let s = 0;
            Object.entries(selection).forEach(([id, qty]) => {
                const p = combo.productos.find(pp => String(pp.id) === id);
                if (p) s += p.precio * qty;
            });
            return s;
        };

        const updateSummary = () => {
            const total = Object.values(selection).reduce((a, b) => a + b, 0);
            summarySel.innerHTML = `<i class="fas fa-boxes"></i> Agregados: <b>${total}</b> / ${req}`;

            if (total === req) {
                const raw = getSelectionSum();
                let final;
                if (combo.tipo_descuento === 'PRECIO_FIJO') {
                    final = combo.precio_total;
                    summaryPrice.innerHTML = `<span class="old">$${raw.toFixed(2)}</span> Paga <b>$${combo.precio_total.toFixed(2)}</b>`;
                } else {
                    const disc = combo.descuento_porcentaje || 0;
                    final = raw * (1 - disc / 100);
                    summaryPrice.innerHTML = `<span class="old">$${raw.toFixed(2)}</span> <b>$${final.toFixed(2)}</b> <span class="save">(-${disc}%)</span>`;
                }
                const savings = Math.max(0, raw - final);
                if (savingsHint) {
                    savingsHint.innerHTML = `<i class="fas fa-star"></i> ¡Perfecto! Estás ahorrando <b>$${savings.toFixed(2)}</b>. <strong>No lo pienses más, llévatelo.</strong>`;
                    savingsHint.className = 'combo-savings-hint ready';
                }
                addBtn.disabled = false;
                addBtn.style.opacity = '1';
                addBtn.innerHTML = `<i class="fas fa-shopping-cart"></i> ¡Añadir y Ahorrar!`;
            } else {
                const remaining = req - total;
                summaryPrice.innerHTML = `Selecciona <b>${remaining}</b> producto${remaining !== 1 ? 's' : ''} más`;
                if (savingsHint) {
                    if (total > 0) {
                        savingsHint.innerHTML = `<i class="fas fa-fire"></i> Te faltan <b>${remaining}</b> para activar tu ahorro garantizado. ¡Vamos!`;
                    } else {
                        savingsHint.innerHTML = `<i class="fas fa-lightbulb"></i> Combina <b>${req}</b> producto${req !== 1 ? 's' : ''} y descubre tu descuento al instante.`;
                    }
                    savingsHint.className = 'combo-savings-hint';
                }
                addBtn.disabled = true;
                addBtn.style.opacity = '0.5';
                addBtn.innerHTML = `<i class="fas fa-gift"></i> Elige ${req} producto${req !== 1 ? 's' : ''}`;
            }
        };

        combo.productos.forEach(p => {
            const key = String(p.id);
            const img = p.imagen || 'https://placehold.co/400x400/eeeeee/999999?text=Sin+Imagen';
            const row = document.createElement('div');
            row.classList.add('combo-product-row');
            row.innerHTML = `
                <img src="${img}" alt="${p.nombre}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/400x400/eeeeee/999999?text=Sin+Imagen';">
                <div class="combo-product-info">
                    <div class="combo-product-name">${p.nombre}</div>
                    <div class="combo-product-price">$${p.precio.toFixed(2)}</div>
                </div>
                <div class="combo-qty-controls">
                    <button class="combo-qty-btn minus" data-id="${key}"><i class="fas fa-minus"></i></button>
                    <input type="number" class="combo-qty-val" data-id="${key}" value="0" readonly>
                    <button class="combo-qty-btn plus" data-id="${key}"><i class="fas fa-plus"></i></button>
                </div>
            `;
            listEl.appendChild(row);

            const valInput = row.querySelector('.combo-qty-val');
            row.querySelector('.minus').addEventListener('click', () => {
                if (selection[key] > 0) {
                    selection[key]--;
                    valInput.value = selection[key];
                    row.classList.toggle('selected', selection[key] > 0);
                    updateSummary();
                }
            });
            row.querySelector('.plus').addEventListener('click', () => {
                const totalSelected = Object.values(selection).reduce((a, b) => a + b, 0);
                if (totalSelected >= req) return;
                if (combo.exigir_productos_distintos && selection[key] >= 1) return;
                selection[key]++;
                valInput.value = selection[key];
                row.classList.add('selected');
                updateSummary();
            });
        });

        addBtn.onclick = () => {
            const total = Object.values(selection).reduce((a, b) => a + b, 0);
            if (total !== req) return;

            const items = [];
            let raw = 0;
            Object.entries(selection).forEach(([id, qty]) => {
                const p = combo.productos.find(pp => String(pp.id) === id);
                if (p && qty > 0) {
                    items.push({ nombre: p.nombre, cantidad: qty, precio: p.precio, codigo: p.codigo });
                    raw += p.precio * qty;
                }
            });
            let final = raw;
            if (combo.tipo_descuento === 'PRECIO_FIJO') {
                final = combo.precio_total;
            } else {
                final = raw * (1 - (combo.descuento_porcentaje || 0) / 100);
            }

            const comboItem = {
                id: `combo_mix_${combo.id}_${Date.now()}`,
                codigo: `COMBO${combo.id}`,
                nombre: `COMBO MIX: ${combo.nombre}`,
                imagen: combo.imagen,
                precio: final,
                quantity: 1,
                es_combo_mix: true,
                combo_items: items,
                _rawSum: raw
            };
            addToCart(comboItem);
            modal.classList.remove('active');
        };

        modal.classList.add('active');
        updateSummary();
    }

    function closeComboBuilder() {
        const modal = document.getElementById('comboModal');
        if (modal) modal.classList.remove('active');
    }

    // --- Modal de Promoción Pack (Combo/Pack) ---
    let packWebProducto = null;
    let packWebCantidad = 1;

    function abrirPackModalWeb(product) {
        const promo = product.promocion;
        const modal = document.getElementById('packPromoModal');
        if (!modal || !promo) return;
        packWebProducto = product;
        packWebCantidad = 1;

        document.getElementById('ppkWebNombre').textContent = product.nombre;
        const img = document.getElementById('ppkWebImg');
        const imgSrc = product.imagen ? product.imagen : 'https://placehold.co/400x400/eeeeee/999999?text=Sin+Imagen';
        if (product.imagen) { img.src = imgSrc; img.style.display = 'block'; } else { img.style.display = 'none'; }
        document.getElementById('ppkWebUnitario').textContent = '$' + (product.precio || 0).toFixed(2);
        document.getElementById('ppkWebUnitario2').textContent = (product.precio || 0).toFixed(2);
        document.getElementById('ppkWebDesc').textContent = promo.descripcion || 'Combo Pack';
        document.getElementById('ppkWebPackMin').textContent = promo.cantidad_minima || 3;
        document.getElementById('ppkWebPackMin2').textContent = promo.cantidad_minima || 3;
        document.getElementById('ppkWebPackPrecio').textContent = (promo.precio_especial || 0).toFixed(2);
        document.getElementById('ppkWebPackPrecio2').textContent = (promo.precio_especial || 0).toFixed(2);
        const ahorro = (product.precio * (promo.cantidad_minima || 3)) - (promo.precio_especial || 0);
        document.getElementById('ppkWebAhorro').textContent = '$' + (ahorro > 0 ? ahorro : 0).toFixed(2);
        document.getElementById('ppkWebOpciones').style.display = 'flex';
        document.getElementById('ppkWebPicker').style.display = 'none';
        actualizarPackWebUI();
        modal.classList.add('active');
    }

    function actualizarPackWebUI() {
        if (!packWebProducto) return;
        const promo = packWebProducto.promocion;
        const min = promo.cantidad_minima || 3;
        const precio = promo.precio_especial || 0;
        const q = packWebCantidad;
        document.getElementById('ppkWebQty').textContent = q;
        document.getElementById('ppkWebTotal').textContent = '$' + (q * precio).toFixed(2);
        document.getElementById('ppkWebBreakdown').textContent = q + ' pack(s) de ' + min + ' unidades (' + (q * min) + ' en total)';
        const minusBtn = document.getElementById('ppkWebMinus');
        const plusBtn = document.getElementById('ppkWebPlus');
        minusBtn.disabled = q <= 1;
        plusBtn.disabled = q >= 3;
        minusBtn.style.opacity = minusBtn.disabled ? '0.4' : '1';
        plusBtn.style.opacity = plusBtn.disabled ? '0.4' : '1';
        minusBtn.style.pointerEvents = minusBtn.disabled ? 'none' : 'auto';
        plusBtn.style.pointerEvents = plusBtn.disabled ? 'none' : 'auto';
    }

    function cerrarPackModalWeb() {
        const modal = document.getElementById('packPromoModal');
        if (modal) modal.classList.remove('active');
    }

    function manageLoadMoreButton(products) {
        const existingBtn = document.getElementById('loadMoreBtnContainer');
        if (existingBtn) {
            existingBtn.remove();
        }

        if (currentPage * itemsPerPage < products.length) {
            const btnContainer = document.createElement('div');
            btnContainer.id = 'loadMoreBtnContainer';
            btnContainer.style.gridColumn = '1 / -1';
            btnContainer.style.textAlign = 'center';
            btnContainer.style.marginTop = '2rem';

            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.classList.add('filter-btn');
            loadMoreBtn.style.padding = '0.8rem 2rem';
            loadMoreBtn.style.fontSize = '1rem';
            loadMoreBtn.style.background = 'var(--accent-color)';
            loadMoreBtn.style.color = 'white';
            loadMoreBtn.style.cursor = 'pointer';
            loadMoreBtn.textContent = 'Cargar más productos';
            
            loadMoreBtn.addEventListener('click', () => {
                currentPage++;
                renderProducts(currentFilteredProducts, false); // Añadir sin limpiar
            });

            btnContainer.appendChild(loadMoreBtn);
            productsGrid.appendChild(btnContainer);
        }
    }

    // Hero Promo Button
    const heroPromoBtn = document.getElementById('heroPromoBtn');
    if (heroPromoBtn) {
        heroPromoBtn.addEventListener('click', () => {
            const promoBtn = document.querySelector('.filter-btn[data-category="ofertas_especiales"]');
            if (promoBtn) {
                promoBtn.click();
            } else {
                showToast('<i class="fas fa-info-circle"></i> Actualmente no hay promociones activas.');
            }
        });
    }

    const quickCombosBtn = document.getElementById('quickCombosBtn');
    if (quickCombosBtn) {
        quickCombosBtn.addEventListener('click', () => {
            const combosBtn = document.querySelector('.filter-btn[data-category="combos_mixtos"]');
            const combosPromoBtn = document.querySelector('.filter-btn[data-category="COMBOS PROMOCIÓN"]');
            if (combosBtn) {
                combosBtn.click();
                window.scrollTo({top: document.querySelector('.main-search-section').offsetTop - 100, behavior: 'smooth'});
            } else if (combosPromoBtn) {
                combosPromoBtn.click();
                window.scrollTo({top: document.querySelector('.main-search-section').offsetTop - 100, behavior: 'smooth'});
            } else {
                showToast('<i class="fas fa-info-circle"></i> Actualmente no hay combos disponibles.');
            }
        });
    }

    // --- 4. Generación de Botones de Categoría Dinámicos ---
    function generateCategoryButtons(products) {
        // Extraer categorías únicas y ordenarlas alfabéticamente
        const uniqueCategories = [...new Set(products.map(p => p.categoria))].sort();
        const categories = ['Todos', ...uniqueCategories];
        
        categoryFilters.innerHTML = ''; // Limpiar

        categories.forEach(category => {
            const btn = document.createElement('button');
            btn.classList.add('filter-btn');
            if (category === 'Todos') btn.classList.add('active');
            
            btn.dataset.category = category;

            // Contar productos por categoría (ya no se muestra, pero se conserva para futuros usos)
            btn.innerHTML = `<span class="cat-name">${category}</span>`;
            
            btn.addEventListener('click', () => {
                // Si el usuario navega a una categoría, limpiamos el buscador principal 
                // para que no haya un filtro de texto activo ocultando los resultados.
                const searchInput = document.getElementById('searchInput');
                const clearSearchBtn = document.getElementById('clearSearch');
                if (searchInput && searchInput.value !== '') {
                    searchInput.value = '';
                    if (clearSearchBtn) clearSearchBtn.style.display = 'none';
                }

                // Actualizar estado activo
                document.querySelectorAll('#categoryFilters .filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Filtrar productos
                filterProducts();

                // Scroll automático hacia los productos
                const productsSection = document.getElementById('productsGrid');
                if (productsSection) {
                    const offset = 120; // Espacio para el header sticky
                    const top = productsSection.getBoundingClientRect().top + window.scrollY - offset;
                    window.scrollTo({ top, behavior: 'smooth' });
                }
            });

            categoryFilters.appendChild(btn);
        });

        // --- Botón especial de Novedades ---
        if (newProductCodes.size > 0) {
            const novBtn = document.createElement('button');
            novBtn.classList.add('filter-btn');
            novBtn.dataset.category = 'novedades';
            novBtn.innerHTML = `<span class="cat-name"><i class="fas fa-bell" style="color:#10b981; margin-right:4px;"></i> Novedades</span><span class="cat-count" style="background:#10b981; color:white;">${newProductCodes.size}</span>`;
            novBtn.style.fontWeight = 'bold';

            novBtn.addEventListener('click', () => {
                const searchInput = document.getElementById('searchInput');
                const clearSearchBtn = document.getElementById('clearSearch');
                if (searchInput && searchInput.value !== '') {
                    searchInput.value = '';
                    if (clearSearchBtn) clearSearchBtn.style.display = 'none';
                }

                document.querySelectorAll('#categoryFilters .filter-btn').forEach(b => b.classList.remove('active'));
                novBtn.classList.add('active');
                filterProducts();
                const productsSection = document.getElementById('productsGrid');
                if (productsSection) {
                    const top = productsSection.getBoundingClientRect().top + window.scrollY - 120;
                    window.scrollTo({ top, behavior: 'smooth' });
                }
            });

            // Insertar justo al inicio (primer posición, después de 'Todos')
            if (categoryFilters.children.length > 1) {
                categoryFilters.insertBefore(novBtn, categoryFilters.children[1]);
            } else {
                categoryFilters.appendChild(novBtn);
            }
        }

        // --- Botón especial de Ofertas ---
        let promoCount = 0;
        if (configData.promocion_activa && configData.promociones) {
            promoCount += configData.promociones.filter(p => p.activa !== false).length;
        }
        
        // Agregar conteo de productos con promocion individual excluyendo los ya contados para no duplicar?
        // En realidad, un contador unico de productos promocionales:
        let promotedProductsCount = products.filter(p => {
            if (p.tiene_promocion) return true;
            if (configData.promocion_activa && configData.promociones) {
                return configData.promociones.some(cp => String(cp.codigo_producto) === String(p.codigo) && cp.activa !== false);
            }
            return false;
        }).length;

        if (promotedProductsCount > 0) {
            const promoBtn = document.createElement('button');
            promoBtn.classList.add('filter-btn');
            promoBtn.dataset.category = 'ofertas_especiales';
            promoBtn.innerHTML = `<span class="cat-name"><i class="fas fa-star" style="color:#f59e0b; margin-right:4px;"></i> Promociones</span><span class="cat-count" style="background:#f59e0b;">${promotedProductsCount}</span>`;
            promoBtn.style.fontWeight = 'bold';
            
            promoBtn.addEventListener('click', () => {
                const searchInput = document.getElementById('searchInput');
                const clearSearchBtn = document.getElementById('clearSearch');
                if (searchInput && searchInput.value !== '') {
                    searchInput.value = '';
                    if (clearSearchBtn) clearSearchBtn.style.display = 'none';
                }

                document.querySelectorAll('#categoryFilters .filter-btn').forEach(b => b.classList.remove('active'));
                promoBtn.classList.add('active');
                filterProducts();
                const productsSection = document.getElementById('productsGrid');
                if (productsSection) {
                    const top = productsSection.getBoundingClientRect().top + window.scrollY - 120;
                    window.scrollTo({ top, behavior: 'smooth' });
                }
            });
            
            // Insertar justo después del botón "Todos"
            if (categoryFilters.children.length > 1) {
                categoryFilters.insertBefore(promoBtn, categoryFilters.children[1]);
            } else {
                categoryFilters.appendChild(promoBtn);
            }

            // Activar el botón de ofertas rápidas en la barra de búsqueda
            const quickPromoBtn = document.getElementById('quickPromoBtn');
            if (quickPromoBtn) {
                quickPromoBtn.style.display = 'flex';
                // Remove previous event listeners if generateCategoryButtons is called multiple times
                const newQuickBtn = quickPromoBtn.cloneNode(true);
                quickPromoBtn.parentNode.replaceChild(newQuickBtn, quickPromoBtn);
                newQuickBtn.addEventListener('click', () => {
                    promoBtn.click();
                });
            }
        } else {
            const quickPromoBtn = document.getElementById('quickPromoBtn');
            if (quickPromoBtn) quickPromoBtn.style.display = 'none';
        }

        // --- Botón especial de Combos Mix (desde productos.json) ---
        if (combosMixtos.length > 0) {
            const cbBtn = document.createElement('button');
            cbBtn.classList.add('filter-btn');
            cbBtn.dataset.category = 'combos_mixtos';
            cbBtn.innerHTML = `<span class="cat-name"><i class="fas fa-gift" style="color:#8b5cf6; margin-right:4px;"></i> Combos Mix</span><span class="cat-count" style="background:#8b5cf6; color:white;">${combosMixtos.length}</span>`;
            cbBtn.style.fontWeight = 'bold';

            cbBtn.addEventListener('click', () => {
                const searchInput = document.getElementById('searchInput');
                const clearSearchBtn = document.getElementById('clearSearch');
                if (searchInput && searchInput.value !== '') {
                    searchInput.value = '';
                    if (clearSearchBtn) clearSearchBtn.style.display = 'none';
                }

                document.querySelectorAll('#categoryFilters .filter-btn').forEach(b => b.classList.remove('active'));
                cbBtn.classList.add('active');
                filterProducts();
                const productsSection = document.getElementById('productsGrid');
                if (productsSection) {
                    const top = productsSection.getBoundingClientRect().top + window.scrollY - 120;
                    window.scrollTo({ top, behavior: 'smooth' });
                }
            });

            // Insertar justo después del botón "Todos"
            if (categoryFilters.children.length > 1) {
                categoryFilters.insertBefore(cbBtn, categoryFilters.children[1]);
            } else {
                categoryFilters.appendChild(cbBtn);
            }
        }

        // Indicador de scroll: mostrar/ocultar degradado según posición
        const filterList = categoryFilters;
        const sidebarEl = filterList.closest('.sidebar-categories');
        if (sidebarEl) {
            function updateScrollIndicator() {
                const canScrollDown = filterList.scrollTop + filterList.clientHeight < filterList.scrollHeight - 5;
                const canScrollUp = filterList.scrollTop > 5;
                sidebarEl.classList.toggle('has-scroll-down', canScrollDown);
                sidebarEl.classList.toggle('has-scroll-up', canScrollUp);
            }
            filterList.addEventListener('scroll', updateScrollIndicator);
            // Llamar una vez al cargar para estado inicial
            setTimeout(updateScrollIndicator, 100);
        }

        // Lógica de búsqueda para las categorías
        if (categorySearchInput) {
            categorySearchInput.addEventListener('input', (e) => {
                if (e.isTrusted && searchInput && searchInput.value !== '') {
                    searchInput.value = '';
                    searchInput.dispatchEvent(new Event('input'));
                }

                const term = normalizeString(e.target.value).trim();
                const buttons = categoryFilters.querySelectorAll('.filter-btn');
                
                buttons.forEach(btn => {
                    const catName = normalizeString(btn.querySelector('.cat-name')?.textContent || btn.textContent);
                    btn.style.display = catName.includes(term) ? 'flex' : 'none';
                });

                // Actualizar indicador tras filtrar
                const sidebarEl = categoryFilters.closest('.sidebar-categories');
                if (sidebarEl) {
                    const canScrollDown = categoryFilters.scrollHeight > categoryFilters.clientHeight;
                    sidebarEl.classList.toggle('has-scroll-down', canScrollDown);
                }
            });
        }
    }

    function normalizeString(str) {
        if (!str) return '';
        return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    // --- Búsqueda Difusa (Levenshtein) ---
    function levenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const matrix = [];
        for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
        for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    function sonSimilares(palabra1, palabra2) {
        if (palabra1.length <= 3 || palabra2.length <= 3) return palabra1 === palabra2;
        const distancia = levenshteinDistance(palabra1, palabra2);
        const maxErrores = palabra1.length > 5 ? 2 : 1;
        return distancia <= maxErrores;
    }

    // --- Diccionario de Sinónimos Global (Agrupado) ---
    const gruposSinonimos = [
        // Foamy / Fomix
        ['fomix', 'foamy', 'fomi', 'foami', 'goma eva'],
        // Goma / Pegamento
        ['goma', 'pegamento', 'pegameto', 'pega', 'pegante', 'pegapel', 'adhesivo', 'adhesi', 'gomo', 'gomas', 'silicona', 'silicon', 'encolar'],
        // Esferos / Bolígrafos
        ['esfero', 'esferos', 'boligrafo', 'boligrafos', 'pluma', 'plumas', 'lapicero', 'lapiceros'],
        // Corrector
        ['corrector', 'correcto', 'correctores', 'liquid', 'liquid paper', 'tipex', 'blanco'],
        // Cuadernos
        ['cuaderno', 'cuadernos', 'libreta', 'libretas', 'diario', 'libretin'],
        // Marcadores
        ['marcador', 'marcadores', 'plumon', 'plumones', 'marcatodo'],
        // Resaltadores
        ['resaltador', 'resaltadores', 'fosforescente', 'fluorescente', 'destacador'],
        // Sacapuntas
        ['sacapuntas', 'tajador', 'tajadores', 'afilalapices', 'cortalapices'],
        // Borrador
        ['borrador', 'borradores', 'goma de borrar', 'queso'],
        // Estilete
        ['estilete', 'estiletes', 'cutter', 'exacto', 'cuchilla', 'bisturi'],
        // Carpeta
        ['carpeta', 'carpetas', 'folder', 'folderes', 'archivador'],
        // Grapadora
        ['grapadora', 'engrapadora', 'grapadoras', 'engrapadoras'],
        // Cintas
        ['cinta', 'cintas', 'scotch', 'masking', 'taipe', 'adhesiva'],
        // Diccionario (con error ortográfico común)
        ['diccionario', 'dicionario'],
        // Cartulina (con error ortográfico común)
        ['cartulina', 'cartulinas', 'cartilina'],
        // Lápices
        ['lapiz', 'lapices', 'lapis', 'lapises', 'carboncillo'],
        // Perforadora
        ['perforadora', 'perforadoras', 'huequeadora', 'abrecuecos'],
        // Crayones
        ['crayones', 'crayola', 'crayolas', 'pinturas de cera'],
        // Escarcha
        ['escarcha', 'escarchas', 'purpurina', 'brillantina'],
        // Tijeras
        ['tijera', 'tijeras', 'piquete'],
        // Notas Adhesivas
        ['notas', 'banderitas', 'post it', 'post-it', 'postit', 'stickers'],
        // Plastilina
        ['plastilina', 'plastilinas', 'masa', 'masas', 'play doh'],
        // Clips
        ['clips', 'clip', 'clics', 'clic'],
        // Tachuelas
        ['tachuelas', 'chinches', 'chinchetas'],
        // Juegos
        ['juego', 'juegos', 'juguete', 'juguetes', 'didactico', 'didacticos', 'entretenimiento'],
        // Libros y Cuentos
        ['cuento', 'cuentos', 'libro', 'libros', 'historia', 'historias', 'lectura'],
        // Manualidades (Mullos, Lentejuelas)
        ['lentejuela', 'lentejuelas', 'mullo', 'mullos', 'pepa', 'pepas', 'cuenta', 'cuentas'],
        // Cuerdas y Hilos
        ['hilo', 'hilos', 'cuerda', 'cuerdas', 'lana', 'lanas', 'soga', 'sogas', 'piola', 'piolas'],
        // Pinceles
        ['pincel', 'pinceles', 'brocha', 'brochas'],
        // Pinturas
        ['pintura', 'pinturas', 'acuarela', 'acuarelas', 'tempera', 'temperas', 'oleo', 'acrilico']
    ];

    function filterCategories() {
        const term = normalizeString(categorySearchInput.value).trim();
        const buttons = categoryFilters.querySelectorAll('.filter-btn');
        
        buttons.forEach(btn => {
            const isEspecial = (btn.dataset.category === 'Todos' || btn.dataset.category === 'novedades' || btn.dataset.category === 'ofertas_especiales');
            const catName = normalizeString(btn.querySelector('.cat-name')?.textContent || btn.textContent);
            
            const catWords = catName.split(/\s+/);
            let matches = catName.includes(term);
            
            if (!matches && term !== '') {
                const singular1 = term.endsWith('es') ? term.slice(0, -2) : null;
                const singular2 = term.endsWith('s') ? term.slice(0, -1) : null;
                const terminosAVerificar = [term, singular1, singular2].filter(Boolean);
                
                // Sinónimos (con tolerancia a errores de tipeo)
                for (let t of terminosAVerificar) {
                    const grupoEncontrado = gruposSinonimos.find(grupo => grupo.some(s => sonSimilares(t, s)));
                    if (grupoEncontrado && grupoEncontrado.some(sinonimo => catName.includes(sinonimo))) {
                        matches = true;
                        break;
                    }
                }
                
                // Fuzzy Search
                if (!matches) {
                    if (terminosAVerificar.some(t => catWords.some(cw => sonSimilares(t, cw)))) {
                        matches = true;
                    }
                }
            }

            if (isEspecial && term !== '') {
                btn.style.display = matches ? 'flex' : 'none';
            } else {
                btn.style.display = (term === '' || matches) ? 'flex' : 'none';
            }
        });

        const sidebarEl = categoryFilters.closest('.sidebar-categories');
        if (sidebarEl) {
            const canScrollDown = categoryFilters.scrollHeight > categoryFilters.clientHeight;
            sidebarEl.classList.toggle('has-scroll-down', canScrollDown);
        }
    }

    // --- 5. Lógica de Filtrado (Búsqueda + Categoría) ---
    function filterProducts() {
        const searchTermStr = normalizeString(searchInput.value).trim();
        const searchTerms = searchTermStr ? searchTermStr.split(/\s+/) : [];
        const activeCategoryBtn = document.querySelector('#categoryFilters .filter-btn.active');
        const activeCategory = activeCategoryBtn ? activeCategoryBtn.dataset.category : 'Todos';

        // Lógica de botones rápidos
        const quickPromoBtn = document.getElementById('quickPromoBtn');
        const quickBackBtn = document.getElementById('quickBackBtn');
        const promoFilterBtn = document.querySelector('.filter-btn[data-category="ofertas_especiales"]');
        
        if (quickPromoBtn && quickBackBtn) {
            if (activeCategory === 'ofertas_especiales' || activeCategory === 'combos_mixtos') {
                quickPromoBtn.style.display = 'none';
                quickBackBtn.style.display = 'flex';
            } else {
                quickPromoBtn.style.display = promoFilterBtn ? 'flex' : 'none';
                quickBackBtn.style.display = 'none';
            }
        }

        // Vista especial de Combos Mix (usa la lista agrupada de productos.json, no los productos individuales)
        if (activeCategory === 'combos_mixtos') {
            currentFilteredProducts = combosMixtos.slice();
            renderProducts(currentFilteredProducts, true);
            return;
        }

        currentFilteredProducts = allProducts.filter(product => {
            if (product.es_unidad_hija) return false;

            const productName = normalizeString(product.nombre);
            const productCategory = normalizeString(product.categoria);
            const productDesc = normalizeString(product.descripcion);
            const productCode = normalizeString(String(product.codigo));
            
            const searchableText = `${productName} ${productCategory} ${productDesc} ${productCode}`;
            
            let matchesSearch = true;
            if (searchTerms.length > 0) {
                // Ignorar palabras comunes (stop words)
                const stopWords = new Set(['de', 'el', 'la', 'los', 'las', 'en', 'para', 'con', 'y', 'o', 'un', 'una', 'del', 'al', 'por', 'las', 'los']);
                const filteredTerms = searchTerms.filter(t => !stopWords.has(t));
                const termsToUse = filteredTerms.length > 0 ? filteredTerms : searchTerms;

                matchesSearch = termsToUse.every(term => {
                    // Coincidencia exacta
                    if (searchableText.includes(term)) return true;
                    
                    const singular1 = term.endsWith('es') ? term.slice(0, -2) : null;
                    const singular2 = term.endsWith('s') ? term.slice(0, -1) : null;
                    const terminosAVerificar = [term, singular1, singular2].filter(Boolean);

                    // 1. Coincidencia exacta o plural
                    if (terminosAVerificar.some(t => searchableText.includes(t))) return true;
                    
                    // 2. Sinónimos global (con tolerancia a errores de tipeo en la búsqueda)
                    for (let t of terminosAVerificar) {
                        const grupo = gruposSinonimos.find(g => g.some(s => sonSimilares(t, s)));
                        if (grupo && grupo.some(sinonimo => searchableText.includes(sinonimo))) return true;
                    }

                    // 3. Búsqueda Difusa (Errores de tipeo)
                    const productWords = searchableText.split(/\s+/);
                    if (terminosAVerificar.some(t => productWords.some(pw => sonSimilares(t, pw)))) return true;

                    return false;
                });
            }
            
            let matchesCategory = false;
            if (activeCategory === 'Todos') {
                matchesCategory = true;
            } else if (activeCategory === 'ofertas_especiales') {
                if (product.tiene_promocion) {
                    matchesCategory = true;
                } else if (configData.promocion_activa && configData.promociones) {
                    const promo = configData.promociones.find(p => String(p.codigo_producto) === String(product.codigo) && p.activa !== false);
                    if (promo) matchesCategory = true;
                }
            } else if (activeCategory === 'novedades') {
                matchesCategory = newProductCodes.has(String(product.codigo));
            } else {
                matchesCategory = product.categoria === activeCategory;
            }

            return matchesSearch && matchesCategory;
        });

        currentFilteredProducts.sort((a, b) => a.precio - b.precio);
        renderProducts(currentFilteredProducts, true);
    }

    // Event listeners separados
    const searchSuggestionsContainer = document.getElementById('searchSuggestions');
    searchInput.addEventListener('input', (e) => {
        filterProducts();
        
        // Autocomplete suggestions for categories
        if (searchSuggestionsContainer) {
            const query = normalizeString(e.target.value).trim();
            searchSuggestionsContainer.innerHTML = '';
            
            if (query.length > 1) {
                const uniqueCategories = Array.from(new Set(allProducts.map(p => p.categoria)));
                const matchedCategories = uniqueCategories.filter(cat => {
                    if (!cat) return false;
                    const c = normalizeString(cat);
                    
                    if (c.includes(query)) return true;
                    
                    const singular1 = query.endsWith('es') ? query.slice(0, -2) : null;
                    const singular2 = query.endsWith('s') ? query.slice(0, -1) : null;
                    const terminosQuery = [query, singular1, singular2].filter(Boolean);

                    for (let t of terminosQuery) {
                        const grupoEncontrado = gruposSinonimos.find(grupo => grupo.some(s => sonSimilares(t, s)));
                        if (grupoEncontrado && grupoEncontrado.some(sinonimo => c.includes(sinonimo))) return true;
                    }
                    
                    const cWords = c.split(/\s+/);
                    if (terminosQuery.some(t => cWords.some(cw => sonSimilares(t, cw)))) return true;
                    
                    return false;
                });
                
                // Show up to 8 category suggestions
                matchedCategories.slice(0, 8).forEach(cat => {
                    const pill = document.createElement('button');
                    pill.className = 'suggestion-pill';
                    pill.innerHTML = `<i class="fas fa-search"></i> Explorar categoría: <b>${cat}</b>`;
                    pill.onclick = (event) => {
                        event.preventDefault();
                        const catBtn = document.querySelector(`.filter-btn[data-category="${cat}"]`);
                        if (catBtn) {
                            catBtn.click();
                            searchInput.value = '';
                            searchInput.dispatchEvent(new Event('input'));
                            searchSuggestionsContainer.innerHTML = '';
                            const clearSearchBtn = document.getElementById('clearSearch');
                            if(clearSearchBtn) clearSearchBtn.style.display = 'none';
                            
                            const productsSection = document.getElementById('productsGrid');
                            if (productsSection) {
                                const top = productsSection.getBoundingClientRect().top + window.scrollY - 120;
                                window.scrollTo({ top, behavior: 'smooth' });
                            }
                        }
                    };
                    searchSuggestionsContainer.appendChild(pill);
                });
            }
        }
    });

    if (categorySearchInput) {
        // Remover cualquier listener viejo
        const newCatSearch = categorySearchInput.cloneNode(true);
        categorySearchInput.parentNode.replaceChild(newCatSearch, categorySearchInput);
        
        // Asignar el nuevo evento
        document.getElementById('categorySearchInput').addEventListener('input', () => {
            filterCategories();
        });
    }

    // --- 6. Lógica del Carrito de Compras ---
    function openCart() {
        cartOverlay.classList.add('active');
        cartSidebar.classList.add('active');
    }

    function closeCart() {
        cartOverlay.classList.remove('active');
        cartSidebar.classList.remove('active');
    }

    cartToggle.addEventListener('click', openCart);
    closeCartBtn.addEventListener('click', closeCart);
    cartOverlay.addEventListener('click', closeCart);
    
    if (floatingCartBtn) {
        floatingCartBtn.addEventListener('click', openCart);
    }

    function getFinalPrice(product) {
        let finalPrice = product.precio;
        if (product.tiene_promocion && product.promocion) {
            const promo = product.promocion;
            const min = promo.cantidad_minima || 1;
            if (min === 1) finalPrice = promo.precio_especial;
        } else if (configData.promocion_activa && configData.promociones) {
            const promo = configData.promociones.find(p => String(p.codigo_producto) === String(product.codigo) && p.activa !== false);
            if (promo && !promo.solo_lista) {
                finalPrice = promo.precio_promocional || product.precio;
            }
        }
        return finalPrice;
    }

    // Modal de fraccionamiento para varios colores seleccionados de un producto fraccionable
    function abrirFraccionConColores(parentProduct, childProduct, coloresSeleccionados, updateBtnCallback) {
        const fraccionModal = document.getElementById('fraccionModal');
        const lblPrecioCaja = document.getElementById('lblPrecioCaja');
        const lblPrecioUnidad = document.getElementById('lblPrecioUnidad');
        let btnComprarCaja = document.getElementById('btnComprarCaja');
        let btnComprarUnidad = document.getElementById('btnComprarUnidad');
        const closeFraccionModal = document.getElementById('closeFraccionModal');

        const parentPrice = getFinalPrice(parentProduct);
        const childPrice = typeof childProduct.precio === 'number' ? childProduct.precio : parseFloat(childProduct.precio) || parentPrice;

        lblPrecioCaja.textContent = `$${parentPrice.toFixed(2)}`;
        lblPrecioUnidad.textContent = `$${childPrice.toFixed(2)}`;

        // Clonar botones para limpiar eventos previos
        const newBtnCaja = btnComprarCaja.cloneNode(true);
        const newBtnUnidad = btnComprarUnidad.cloneNode(true);
        btnComprarCaja.parentNode.replaceChild(newBtnCaja, btnComprarCaja);
        btnComprarUnidad.parentNode.replaceChild(newBtnUnidad, btnComprarUnidad);
        btnComprarCaja = newBtnCaja;
        btnComprarUnidad = newBtnUnidad;

        fraccionModal.classList.add('active');

        const closeModal = () => fraccionModal.classList.remove('active');

        closeFraccionModal.onclick = closeModal;
        fraccionModal.onclick = (e) => {
            if (e.target === fraccionModal) closeModal();
        };

        btnComprarCaja.addEventListener('click', () => {
            closeModal();
            let wasAdded = false;
            coloresSeleccionados.forEach(({ product, qty }) => {
                const isNewItem = addToCart(product, qty);
                wasAdded = wasAdded || isNewItem;
            });
            if (updateBtnCallback) updateBtnCallback(wasAdded);
        });

        btnComprarUnidad.addEventListener('click', () => {
            closeModal();
            let wasAdded = false;
            coloresSeleccionados.forEach(({ product, qty, colorName, varianteId }) => {
                const unidadConColor = {
                    ...childProduct,
                    id: `${product.id}-UNIDAD-${colorName}`,
                    codigo: childProduct.codigo,
                    nombre: product.nombre + " (UNIDAD)",
                    precio: childPrice,
                    color_seleccionado: colorName,
                    variante_id: varianteId
                };
                const isNewItem = addToCart(unidadConColor, qty);
                wasAdded = wasAdded || isNewItem;
            });
            if (updateBtnCallback) updateBtnCallback(wasAdded);
        });
    }

    function handleAddToCartWithModal(product, updateBtnCallback, qtyToAdd = 1) {
        if (product.variantes && product.variantes.length > 0 && !product.color_seleccionado) {
            const colorModal = document.getElementById('colorVariantModal');
            const swatchesContainer = document.getElementById('colorSwatchesContainer');
            let btnConfirmColor = document.getElementById('btnConfirmColor');
            const closeColorModal = document.getElementById('closeColorModal');
            // Detectar variantes de imagen (cartucheras, modelos, etc.) vs. variantes de color
            const hasImageVariants = product.variantes.some(v => typeof v === 'object' && v.imagen);
            
            // Adaptar textos del modal según el tipo de variante
            const modalTitle = colorModal.querySelector('h3');
            const modalSubtitle = colorModal.querySelector('p');
            if (modalTitle) {
                modalTitle.innerHTML = hasImageVariants
                    ? '<i class="fas fa-box-open"></i> Selecciona tu Modelo'
                    : '<i class="fas fa-palette"></i> Selecciona tus Colores';
            }
            if (modalSubtitle) {
                modalSubtitle.textContent = hasImageVariants
                    ? 'Elige la cantidad de cada modelo que deseas llevar.'
                    : 'Elige las cantidades para los colores que deseas llevar.';
            }

            swatchesContainer.innerHTML = '';
            let selectedQuantities = {};
            const variantByName = {}; // Mapa nombre -> variante para recuperar su imagen
            
            btnConfirmColor.style.display = 'block';
            btnConfirmColor.style.opacity = '0.5';
            btnConfirmColor.style.pointerEvents = 'none';

            const commonColors = {
                "rojo": "#ef4444", "azul": "#3b82f6", "amarillo": "#eab308", 
                "verde": "#22c55e", "naranja": "#f97316", "morado": "#a855f7", 
                "rosa": "#ec4899", "negro": "#000000", "blanco": "#ffffff", "gris": "#6b7280",
                "celeste": "#0ea5e9", "cafe": "#78350f", "marrón": "#78350f"
            };

            const updateConfirmButton = () => {
                const total = Object.values(selectedQuantities).reduce((a, b) => a + b, 0);
                if (total > 0) {
                    btnConfirmColor.style.opacity = '1';
                    btnConfirmColor.style.pointerEvents = 'all';
                    btnConfirmColor.innerHTML = `<i class="fas fa-check"></i> Añadir ${total} al carrito`;
                } else {
                    btnConfirmColor.style.opacity = '0.5';
                    btnConfirmColor.style.pointerEvents = 'none';
                    btnConfirmColor.innerHTML = `<i class="fas fa-check"></i> Confirmar`;
                }
            };

            product.variantes.forEach(variant => {
                const colorName = typeof variant === 'object' ? (variant.nombre || variant.color || 'Variante') : variant;
                let hexCode = (typeof variant === 'object' && variant.hex) ? variant.hex : '';
                const variantImg = (typeof variant === 'object' && variant.imagen) ? variant.imagen : '';
                
                if (!hexCode) {
                    const normalizedColor = colorName.toLowerCase().trim();
                    if (commonColors[normalizedColor]) {
                        hexCode = commonColors[normalizedColor];
                    }
                }
                selectedQuantities[colorName] = 0;
                variantByName[colorName] = variant;
                
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.justifyContent = 'space-between';
                row.style.background = 'var(--card-bg)';
                row.style.border = '1px solid var(--glass-border)';
                row.style.padding = '10px';
                row.style.borderRadius = '12px';
                
                const labelDiv = document.createElement('div');
                labelDiv.style.display = 'flex';
                labelDiv.style.alignItems = 'center';
                labelDiv.style.gap = '10px';
                labelDiv.style.fontWeight = '600';
                
                let maxQty = typeof variant === 'object' ? (variant.stock_visual ?? variant.cantidad ?? variant.stock ?? Infinity) : Infinity;
                if (maxQty === null) maxQty = Infinity; // Handle explicit null in JSON
                
                let stockText = maxQty !== Infinity ? `<span style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 5px;">(Disp: ${maxQty})</span>` : '';
                
                if (variantImg) {
                    labelDiv.innerHTML = `<span class="variant-thumb-wrap"><img src="${variantImg}" class="variant-thumb" title="Clic para ver ampliado" loading="lazy" onerror="this.onerror=null;this.closest('.variant-thumb-wrap').style.display='none';"><i class="fas fa-search-plus variant-thumb-zoom" aria-hidden="true"></i></span> ${colorName} ${stockText}`;
                } else if (hexCode) {
                    labelDiv.innerHTML = `<div style="width: 20px; height: 20px; border-radius: 50%; background-color: ${hexCode}; border: 1px solid rgba(0,0,0,0.1);"></div> ${colorName} ${stockText}`;
                } else {
                    labelDiv.innerHTML = `${colorName} ${stockText}`;
                }
                
                const controlsDiv = document.createElement('div');
                controlsDiv.style.display = 'flex';
                controlsDiv.style.alignItems = 'center';
                controlsDiv.style.gap = '10px';
                
                const btnMinus = document.createElement('button');
                btnMinus.innerHTML = '<i class="fas fa-minus"></i>';
                btnMinus.style.cssText = 'width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--glass-border); background: var(--glass-bg); color: var(--accent-color); cursor: pointer; display: flex; justify-content: center; align-items: center;';
                
                const inputQty = document.createElement('input');
                inputQty.type = 'number';
                inputQty.value = '0';
                inputQty.min = '0';
                inputQty.style.cssText = 'width: 50px; text-align: center; border: 1px solid var(--glass-border); background: transparent; color: var(--text-primary); font-weight: bold; font-size: 1rem;';
                inputQty.readOnly = true;

                const btnPlus = document.createElement('button');
                btnPlus.innerHTML = '<i class="fas fa-plus"></i>';
                btnPlus.style.cssText = 'width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--glass-border); background: var(--glass-bg); color: var(--accent-color); cursor: pointer; display: flex; justify-content: center; align-items: center;';

                btnMinus.onclick = () => {
                    if (selectedQuantities[colorName] > 0) {
                        selectedQuantities[colorName]--;
                        inputQty.value = selectedQuantities[colorName];
                        updateConfirmButton();
                    }
                };
                
                btnPlus.onclick = () => {
                    if (selectedQuantities[colorName] < maxQty) {
                        selectedQuantities[colorName]++;
                        inputQty.value = selectedQuantities[colorName];
                        updateConfirmButton();
                    }
                };

                controlsDiv.appendChild(btnMinus);
                controlsDiv.appendChild(inputQty);
                controlsDiv.appendChild(btnPlus);
                
                row.appendChild(labelDiv);
                row.appendChild(controlsDiv);
                swatchesContainer.appendChild(row);

                // Clic en la imagen/icono de la variante para verla ampliada
                if (variantImg) {
                    const thumbWrap = row.querySelector('.variant-thumb-wrap');
                    if (thumbWrap) {
                        thumbWrap.addEventListener('click', (e) => {
                            e.stopPropagation();
                            openVariantImagePreview(colorName, variantImg, product, getFinalPrice(product));
                        });
                    }
                }
            });

            colorModal.classList.add('active');

            const closeModal = () => colorModal.classList.remove('active');
            closeColorModal.onclick = closeModal;
            colorModal.onclick = (e) => {
                if (e.target === colorModal) closeModal();
            };

            const newBtnConfirm = btnConfirmColor.cloneNode(true);
            btnConfirmColor.parentNode.replaceChild(newBtnConfirm, btnConfirmColor);
            btnConfirmColor = newBtnConfirm;
            
            btnConfirmColor.addEventListener('click', () => {
                closeModal();
                const coloresSeleccionados = [];
                for (const [colorName, qty] of Object.entries(selectedQuantities)) {
                    if (qty > 0) {
                        const chosenVariant = variantByName[colorName] || {};
                        const chosenImg = (typeof chosenVariant === 'object' && chosenVariant.imagen) ? chosenVariant.imagen : product.imagen;
                        const varianteId = (typeof chosenVariant === 'object' && chosenVariant.id) ? chosenVariant.id : null;
                        const productWithColor = { 
                            ...product, 
                            color_seleccionado: colorName, 
                            nombre: `${product.nombre} (${colorName})`, 
                            id: `${product.id}-${colorName}`,
                            variante_id: varianteId,
                            imagen: chosenImg || product.imagen
                        };
                        coloresSeleccionados.push({ product: productWithColor, qty, colorName, varianteId });
                    }
                }
                if (coloresSeleccionados.length === 0) return;

                // Si el producto es fraccionable, abrir UNA sola vez el modal de fraccionamiento
                // y añadir TODOS los colores elegidos (por paquete o por unidad).
                if (product.es_fraccionable) {
                    const childProduct = product.hijo ? { ...product.hijo } : allProducts.find(p => String(p.codigo_padre) === String(product.codigo) && p.es_unidad_hija);
                    if (childProduct) {
                        abrirFraccionConColores(product, childProduct, coloresSeleccionados, updateBtnCallback);
                        return;
                    }
                }

                // Producto normal (no fraccionable): añadir cada color directamente
                let wasAdded = false;
                coloresSeleccionados.forEach(({ product: pc, qty }) => {
                    const isNew = addToCart(pc, qty);
                    wasAdded = wasAdded || isNew;
                });
                if (wasAdded && updateBtnCallback) updateBtnCallback(true);
            });

            return;
        }


        if (product.es_fraccionable) {
            // La unidad suelta (hijo) viaja dentro del campo "hijo" del padre en productos.json
            const childProduct = product.hijo ? { ...product.hijo } : allProducts.find(p => String(p.codigo_padre) === String(product.codigo) && p.es_unidad_hija);
            if (childProduct) {
                const fraccionModal = document.getElementById('fraccionModal');
                const lblPrecioCaja = document.getElementById('lblPrecioCaja');
                const lblPrecioUnidad = document.getElementById('lblPrecioUnidad');
                let btnComprarCaja = document.getElementById('btnComprarCaja');
                let btnComprarUnidad = document.getElementById('btnComprarUnidad');
                const closeFraccionModal = document.getElementById('closeFraccionModal');

                const parentPrice = getFinalPrice(product);
                const childPrice = typeof childProduct.precio === 'number' ? childProduct.precio : parseFloat(childProduct.precio) || parentPrice;

                lblPrecioCaja.textContent = `$${parentPrice.toFixed(2)}`;
                lblPrecioUnidad.textContent = `$${childPrice.toFixed(2)}`;

                // Clonar botones para limpiar eventos previos
                const newBtnCaja = btnComprarCaja.cloneNode(true);
                const newBtnUnidad = btnComprarUnidad.cloneNode(true);
                btnComprarCaja.parentNode.replaceChild(newBtnCaja, btnComprarCaja);
                btnComprarUnidad.parentNode.replaceChild(newBtnUnidad, btnComprarUnidad);
                btnComprarCaja = newBtnCaja;
                btnComprarUnidad = newBtnUnidad;

                fraccionModal.classList.add('active');

                const closeModal = () => fraccionModal.classList.remove('active');

                closeFraccionModal.onclick = closeModal;
                fraccionModal.onclick = (e) => {
                    if (e.target === fraccionModal) closeModal();
                };

                btnComprarCaja.addEventListener('click', () => {
                    closeModal();
                    const isNewItem = addToCart(product, qtyToAdd);
                    if (updateBtnCallback) updateBtnCallback(isNewItem);
                });

                btnComprarUnidad.addEventListener('click', () => {
                    closeModal();
                    // Para que en el carrito se entienda que es la unidad
                    const unidadConColor = { ...childProduct, nombre: product.nombre + " (UNIDAD)", precio: childPrice };
                    const isNewItem = addToCart(unidadConColor, qtyToAdd);
                    if (updateBtnCallback) updateBtnCallback(isNewItem);
                });
                
                return; // Detener ejecución para esperar al modal
            }
        }
        
        // Comportamiento normal si no es fraccionable o no se encontró el hijo
        const isNewItem = addToCart(product, qtyToAdd);
        if (updateBtnCallback) updateBtnCallback(isNewItem);
    }

    function addToCart(product, qtyToAdd = 1) {
        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            existingItem.quantity += qtyToAdd;
            saveCart();
            updateCartUI();
            showToast(`<i class="fas fa-shopping-basket" style="color: #3b82f6;"></i> ¡Añadiste ${qtyToAdd > 1 ? qtyToAdd + ' más de' : 'otro'} <b>${product.nombre}</b>! Tienes excelente gusto.`);
            return false;
        } else {
            cart.push({ ...product, quantity: qtyToAdd });
            saveCart();
            updateCartUI();
            showToast(`<i class="fas fa-check-circle" style="color: #4ade80;"></i> ¡Excelente elección! <b>${product.nombre}</b> añadido a tu carrito.`);
            return true;
        }
    }

    function showToast(message) {
        toast.innerHTML = message;
        toast.style.background = 'var(--card-bg)';
        toast.style.color = 'var(--text-primary)';
        toast.style.border = '2px solid var(--accent-color)';
        toast.style.boxShadow = 'var(--shadow-lg)';
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3500);
    }

    function removeFromCart(productId) {
        cart = cart.filter(item => String(item.id) !== String(productId));
        saveCart();
        updateCartUI();
    }

    function changeQuantity(productId, delta) {
        const item = cart.find(i => String(i.id) === String(productId));
        if (item) {
            item.quantity += delta;
            if (item.quantity <= 0) {
                removeFromCart(productId);
            } else {
                saveCart();
                updateCartUI();
            }
        }
    }

    function saveCart() {
        localStorage.setItem('cart', JSON.stringify(cart));
    }

    function updateCartUI() {
        // Revisar si aplica la promo de lista escolar
        const isSchoolList = document.getElementById('isSchoolList');
        const isPromoList = isSchoolList && isSchoolList.checked;

        // Actualizar el número del icono del carrito
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartBadge.textContent = totalItems;
        if (floatingCartBadge) floatingCartBadge.textContent = totalItems;

        // Mostrar u ocultar botón flotante del carrito
        if (floatingCartBtn) {
            if (totalItems > 0) {
                floatingCartBtn.classList.add('show');
            } else {
                floatingCartBtn.classList.remove('show');
            }
        }

        // Limpiar items
        cartItemsContainer.innerHTML = '';
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<div style="text-align:center; opacity:0.5; margin-top:2rem;">Tu carrito está vacío</div>';
        } else {
            // Renderizar items del carrito
            cart.forEach(item => {
                const div = document.createElement('div');
                div.classList.add('cart-item');
                
                const imgSrc = item.imagen ? item.imagen : 'https://placehold.co/400x400/eeeeee/999999?text=Sin+Imagen';

                // Lógica de cálculo dinámico para el carrito
                let finalItemPrice = item.precio;
                let itemTotal = item.precio * item.quantity;
                let priceHtml = `$${itemTotal.toFixed(2)}`;
                let appliedPromo = false;
                let promoColor = '#ef4444';
                let promoDetailText = '';

                // 1. Promoción Individual (nueva lógica JSON)
                if (item.tiene_promocion && item.promocion) {
                    const promo = item.promocion;
                    const min = promo.cantidad_minima || 1;
                    if (item.quantity >= min) {
                        appliedPromo = true;
                        if (promo.tipo === 'PACK' || (promo.precio_especial > item.precio)) {
                            // Asumimos que si precio_especial > precio unitario, es el precio total de un combo.
                            const numCombos = Math.floor(item.quantity / min);
                            const remainder = item.quantity % min;
                            itemTotal = (numCombos * promo.precio_especial) + (remainder * item.precio);
                            promoColor = '#8b5cf6';
                            promoDetailText = `Promo: ${numCombos}x Combo + ${remainder} ud. sueltas`;
                        } else if (min > 1) {
                            // Descuento mayorista por unidad
                            finalItemPrice = promo.precio_especial;
                            itemTotal = finalItemPrice * item.quantity;
                            promoColor = '#8b5cf6';
                            promoDetailText = `Descuento por volumen aplicado`;
                        } else {
                            finalItemPrice = promo.precio_especial;
                            itemTotal = finalItemPrice * item.quantity;
                            promoColor = '#ef4444';
                        }
                    }
                } 
                // 2. Promoción Global (config.json)
                else if (configData.promocion_activa && configData.promociones) {
                    const promo = configData.promociones.find(p => String(p.codigo_producto) === String(item.codigo) && p.activa !== false);
                    if (promo && promo.precio_promocional) {
                        if (!promo.solo_lista || (promo.solo_lista && isPromoList)) {
                            finalItemPrice = promo.precio_promocional;
                            itemTotal = finalItemPrice * item.quantity;
                            appliedPromo = true;
                            promoColor = promo.solo_lista ? '#f59e0b' : '#ef4444';
                        }
                    }
                }

                // 3. Combo Mix (construido con varios productos)
                if (item.es_combo_mix) {
                    itemTotal = item.precio * item.quantity;
                    const detail = (item.combo_items || []).map(ci => `${ci.cantidad}x ${ci.nombre}`).join(', ');
                    let oldPrice = '';
                    if (item._rawSum && item._rawSum > item.precio + 0.001) {
                        oldPrice = `<span style="text-decoration: line-through; opacity: 0.5; font-size: 0.8rem; margin-right: 0.3rem;">$${(item._rawSum * item.quantity).toFixed(2)}</span>`;
                    }
                    priceHtml = `${oldPrice}<span style="color: #8b5cf6; font-weight: 800;">$${itemTotal.toFixed(2)}</span>`;
                    if (detail) {
                        priceHtml += `<div class="combo-cart-detail"><i class="fas fa-gift"></i> ${detail}</div>`;
                    }
                    item.comboNoteText = '(Combo Mix)';
                }

                if (appliedPromo) {
                    priceHtml = `<span style="text-decoration: line-through; opacity: 0.5; font-size: 0.8rem; margin-right: 0.3rem;">$${(item.precio * item.quantity).toFixed(2)}</span><span style="color: ${promoColor}; font-weight: 800;">$${itemTotal.toFixed(2)}</span>`;
                    
                    if (promoDetailText) {
                        priceHtml += `<div style="font-size: 0.7rem; color: ${promoColor}; margin-top: 2px;"><i class="fas fa-tag"></i> ${promoDetailText}</div>`;
                    }
                }

                item.cartItemTotal = itemTotal; // Guardar para calcular total
                item.appliedPromoText = item.es_combo_mix ? '' : (appliedPromo ? '(Promo aplicada)' : '');

                div.innerHTML = `
                    <img src="${imgSrc}" class="cart-item-img" alt="${item.nombre}" onerror="this.onerror=null;this.src='https://placehold.co/400x400/eeeeee/999999?text=Sin+Imagen';">
                    <div class="cart-item-info">
                        <div class="cart-item-title">${item.nombre}</div>
                        <div class="cart-item-price">${priceHtml}</div>
                        <div class="cart-item-actions">
                            <button class="qty-btn minus" data-id="${item.id}">-</button>
                            <span>${item.quantity}</span>
                            <button class="qty-btn plus" data-id="${item.id}">+</button>
                        </div>
                    </div>
                    <button class="cart-item-remove" data-id="${item.id}"><i class="fas fa-trash"></i></button>
                `;
                cartItemsContainer.appendChild(div);
            });

            // Asignar eventos a los botones de + y - y eliminar
            cartItemsContainer.querySelectorAll('.minus').forEach(btn => {
                btn.addEventListener('click', (e) => changeQuantity(e.target.dataset.id, -1));
            });
            cartItemsContainer.querySelectorAll('.plus').forEach(btn => {
                btn.addEventListener('click', (e) => changeQuantity(e.target.dataset.id, 1));
            });
            cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => {
                btn.addEventListener('click', (e) => removeFromCart(e.currentTarget.dataset.id));
            });
        }

        // Actualizar el total monetario
        const total = cart.reduce((sum, item) => sum + (item.cartItemTotal !== undefined ? item.cartItemTotal : (item.precio * item.quantity)), 0);
        cartTotalValue.textContent = total.toFixed(2);

        // Actualizar el texto de total de artículos
        const cartTotalItemsEl = document.getElementById('cartTotalItems');
        if (cartTotalItemsEl) {
            cartTotalItemsEl.textContent = `${totalItems} artículo${totalItems !== 1 ? 's' : ''}`;
        }
    }

    // --- 7. Enviar Pedido (Checkout por WhatsApp) ---
    checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            showAlert('Agrega productos al carrito primero.');
            return;
        }

        const name = customerName.value.trim();
        const cedula = customerID.value.trim();
        const phone = customerPhone.value.trim();
        const address = customerAddress.value.trim();

        if (!name || !cedula || !phone) {
            showAlert('Por favor, llena tus datos obligatorios (Nombre, Cédula y Teléfono) para enviar el pedido.');
            return;
        }

        // Guardar en LocalStorage para futuras compras
        localStorage.setItem('tatynet_name', name);
        localStorage.setItem('tatynet_id', cedula);
        localStorage.setItem('tatynet_phone', phone);

        // Leer el número desde config.json, si no existe usa un fallback
        const phoneNumber = configData.whatsapp || '1234567890'; 
        const saludo = configData.mensaje_saludo || '¡Hola! Me gustaría hacer un pedido.';

        const isSchoolList = document.getElementById('isSchoolList');
        const isPromoList = isSchoolList && isSchoolList.checked;

        let message = `${saludo}%0A%0A`;
        
        if (isPromoList) {
            message += `🚨 *PEDIDO APLICA PROMO: LISTA DE ÚTILES* 🚨%0A%0A`;
        }

        message += `*Datos del Cliente:*%0A`;
        message += `- Nombre: ${name}%0A`;
        message += `- Cédula: ${cedula}%0A`;
        message += `- Teléfono: ${phone}%0A`;
        if (address) {
            message += `- Notas/Mensaje: ${address}%0A`;
        }
        message += `%0A*Detalle del Pedido:*%0A`;
        
        cart.forEach(item => {
            const itemTotal = item.cartItemTotal !== undefined ? item.cartItemTotal : (item.precio * item.quantity);
            let qtyNote = item.appliedPromoText ? ` ${item.appliedPromoText}` : '';
            let comboDetail = '';
            if (item.es_combo_mix && item.combo_items) {
                // Incluir el código de cada componente para que el importador del sistema los reconstruya
                comboDetail = ` (${item.combo_items.map(ci => `${ci.cantidad}x ${ci.codigo ? ci.codigo + ' ' + ci.nombre : ci.nombre}`).join(', ')})`;
                qtyNote = qtyNote || (item.comboNoteText ? ` ${item.comboNoteText}` : '');
            }
            message += `- ${item.quantity}x ${item.nombre}${comboDetail} (CÓD: ${item.codigo}) [$${itemTotal.toFixed(2)}]${qtyNote}%0A`;
        });
        
        const total = cart.reduce((sum, item) => sum + (item.cartItemTotal !== undefined ? item.cartItemTotal : (item.precio * item.quantity)), 0);
        message += `%0A*Total a Pagar: $${total.toFixed(2)}*`;

        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
        window.open(whatsappUrl, '_blank');

        // Vaciar el carrito después de enviar
        cart = [];
        saveCart();
        updateCartUI();
        
        // Limpiar el formulario
        customerName.value = '';
        customerID.value = '';
        customerPhone.value = '';
        customerAddress.value = '';

        closeCart();
        showToast(`<i class="fas fa-check-circle" style="color: #4ade80;"></i> Pedido procesado`);
    });

    // --- 8. Promo Modal Logic ---
    function initPromoModal(config) {
        const promoModal = document.getElementById('promoModal');
        if (!promoModal || !config.promocion_activa) return;

        // Llenar datos dinámicos
        const titleEl = document.getElementById('promoTitle');
        const subtitleEl = document.getElementById('promoSubtitle');
        const bodyEl = document.getElementById('promoBody');

        if (titleEl) titleEl.textContent = config.promocion_titulo || 'Promoción';
        if (subtitleEl) subtitleEl.textContent = config.promocion_subtitulo || '';

        if (bodyEl && config.promociones && config.promociones.filter(p => p.activa !== false).length > 0) {
            bodyEl.innerHTML = config.promociones.filter(p => p.activa !== false).map(promo => {
                // Buscar el producto real para obtener su imagen
                const matchedProduct = allProducts.find(p => p.codigo === promo.codigo_producto);
                const imgSrc = (matchedProduct && matchedProduct.imagen) ? matchedProduct.imagen : null;
                
                // Si existe la imagen, mostrarla, si no, usar el ícono
                const mediaHtml = imgSrc 
                    ? `<img src="${imgSrc}" alt="${promo.titulo}" style="width: 60px; height: 60px; border-radius: 12px; object-fit: cover; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">`
                    : `<div class="promo-icon"><i class="${promo.icono || 'fas fa-star'}"></i></div>`;

                return `
                <div class="promo-item">
                    ${mediaHtml}
                    <div class="promo-details">
                        <h3>${promo.titulo}</h3>
                        <p>${promo.descripcion}</p>
                        <span class="promo-price">${promo.precio_texto}</span>
                    </div>
                </div>
                `;
            }).join('');
        }

        const closePromoBtn = document.getElementById('closePromoBtn');
        const shopPromoBtn = document.getElementById('shopPromoBtn');

        // Mostrar el modal después de 2 segundos si no ha sido cerrado en esta sesión
        if (!sessionStorage.getItem('promoClosed')) {
            setTimeout(() => {
                promoModal.classList.add('active');
            }, 2000);
        }

        const closePromo = () => {
            promoModal.classList.remove('active');
            sessionStorage.setItem('promoClosed', 'true');
        };

        if (closePromoBtn) closePromoBtn.addEventListener('click', closePromo);
        if (shopPromoBtn) {
            shopPromoBtn.addEventListener('click', () => {
                closePromo();
            });
        }
        
        // Cerrar al hacer clic fuera del modal
        promoModal.addEventListener('click', (e) => {
            if (e.target === promoModal) {
                closePromo();
            }
        });
    }

    // --- 9. Protección Anti-Copia y Seguridad Básica ---
    
    // Deshabilitar el clic derecho (Menú contextual)
    document.addEventListener('contextmenu', (e) => {
        // Permitir clic derecho en campos de texto para poder pegar
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }
    });

    // Deshabilitar atajos de teclado comunes para inspeccionar o guardar (F12, Ctrl+Shift+I, Ctrl+U, Ctrl+S)
    document.addEventListener('keydown', (e) => {
        if (
            e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && e.key === 'I') || 
            (e.ctrlKey && e.shiftKey && e.key === 'J') || 
            (e.ctrlKey && e.shiftKey && e.key === 'C') || 
            (e.ctrlKey && e.key === 'U') || 
            (e.ctrlKey && e.key === 'S') ||
            (e.key === 'PrintScreen') // Intento de bloquear ImprPant (no todos los navegadores lo soportan)
        ) {
            e.preventDefault();
        }
    });

    // Deshabilitar arrastrar imágenes
    document.addEventListener('dragstart', (e) => {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
        }
    });

    // --- 10. Botón Volver Arriba ---
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                backToTopBtn.classList.add('show');
            } else {
                backToTopBtn.classList.remove('show');
            }
        });

        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // --- 11. Image Modal Logic ---
    const imageModal = document.getElementById('imageModal');
    const closeImageModalBtn = document.getElementById('closeImageModal');
    if (imageModal && closeImageModalBtn) {
        closeImageModalBtn.addEventListener('click', () => {
            imageModal.classList.remove('active');
        });
        imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal) {
                imageModal.classList.remove('active');
            }
        });
    }

    // --- 11b. Combo Builder Modal ---
    const comboModal = document.getElementById('comboModal');
    const closeComboModalBtn = document.getElementById('closeComboModal');
    if (comboModal && closeComboModalBtn) {
        closeComboModalBtn.addEventListener('click', closeComboBuilder);
        comboModal.addEventListener('click', (e) => {
            if (e.target === comboModal) closeComboBuilder();
        });
    }

    // --- 11c. Modal de Promoción Pack (Combo/Pack) ---
    const packPromoModalEl = document.getElementById('packPromoModal');
    const closePackPromoBtn = document.getElementById('closePackPromoModal');
    if (packPromoModalEl && closePackPromoBtn) {
        closePackPromoBtn.addEventListener('click', cerrarPackModalWeb);
        packPromoModalEl.addEventListener('click', (e) => {
            if (e.target === packPromoModalEl) cerrarPackModalWeb();
        });
        document.getElementById('ppkWebPorUnidad').addEventListener('click', () => {
            if (!packWebProducto) return;
            addToCart(packWebProducto, 1);
            cerrarPackModalWeb();
        });
        document.getElementById('ppkWebPorCombo').addEventListener('click', () => {
            packWebCantidad = 1;
            document.getElementById('ppkWebOpciones').style.display = 'none';
            document.getElementById('ppkWebPicker').style.display = 'block';
            actualizarPackWebUI();
        });
        document.getElementById('ppkWebMinus').addEventListener('click', () => {
            if (packWebCantidad > 1) { packWebCantidad--; actualizarPackWebUI(); }
        });
        document.getElementById('ppkWebPlus').addEventListener('click', () => {
            if (packWebCantidad < 3) { packWebCantidad++; actualizarPackWebUI(); }
        });
        document.getElementById('ppkWebAdd').addEventListener('click', () => {
            if (!packWebProducto) return;
            const units = packWebCantidad * (packWebProducto.promocion.cantidad_minima || 3);
            addToCart(packWebProducto, units);
            cerrarPackModalWeb();
        });
    }

    // --- 12. Detección de Productos Nuevos (via localStorage) ---
    function detectNewProducts(products) {
        const STORAGE_KEY = 'tatynet_seen_products';
        const currentCodes = products.map(p => String(p.codigo));
        const seenCodesRaw = localStorage.getItem(STORAGE_KEY);

        if (!seenCodesRaw) {
            // Primera visita: guardar todos como "vistos" sin marcar ninguno como nuevo
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentCodes));
            newProductCodes = new Set();
            return;
        }

        const seenCodes = new Set(JSON.parse(seenCodesRaw));

        // Los que están en el JSON actual pero NO en los vistos = NUEVOS
        currentCodes.forEach(code => {
            if (!seenCodes.has(code)) {
                newProductCodes.add(code);
            }
        });

        // Actualizar localStorage con la lista actual completa
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentCodes));
    }

    function showNewProductsBanner(count) {
        // No mostrar si ya fue cerrado en esta sesión
        if (sessionStorage.getItem('newProductsBannerClosed')) return;

        const banner = document.createElement('div');
        banner.id = 'newProductsBanner';
        banner.className = 'new-products-banner';
        banner.innerHTML = `
            <div class="new-banner-content">
                <div class="new-banner-icon"><i class="fas fa-bell"></i></div>
                <div class="new-banner-text">
                    <strong>¡${count} producto${count > 1 ? 's nuevos' : ' nuevo'} disponible${count > 1 ? 's' : ''}!</strong>
                    <span>Revisa las últimas novedades que llegaron a TATYNET</span>
                </div>
                <button class="new-banner-btn" id="verNovBtn">
                    <i class="fas fa-eye"></i> Ver
                </button>
                <button class="new-banner-close" id="closeBannerBtn" aria-label="Cerrar">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Insertar después del header
        const header = document.querySelector('.glass-header');
        if (header && header.nextSibling) {
            header.parentNode.insertBefore(banner, header.nextSibling);
        } else {
            document.body.prepend(banner);
        }

        // Animar entrada
        requestAnimationFrame(() => banner.classList.add('visible'));

        // Botón Ver Novedades: activar filtro
        document.getElementById('verNovBtn')?.addEventListener('click', () => {
            closeBanner();
            // Activar el botón de Novedades en la barra de categorías
            const novBtn = document.querySelector('[data-category="novedades"]');
            if (novBtn) {
                document.querySelectorAll('#categoryFilters .filter-btn').forEach(b => b.classList.remove('active'));
                novBtn.classList.add('active');
                filterProducts();
                const grid = document.getElementById('productsGrid');
                if (grid) {
                    const top = grid.getBoundingClientRect().top + window.scrollY - 120;
                    window.scrollTo({ top, behavior: 'smooth' });
                }
            }
        });

        // Botón cerrar
        document.getElementById('closeBannerBtn')?.addEventListener('click', closeBanner);

        function closeBanner() {
            banner.classList.remove('visible');
            setTimeout(() => banner.remove(), 400);
            sessionStorage.setItem('newProductsBannerClosed', 'true');
        }
    }

});

// =========================================
// PROTECCIÓN ANTI-COPIA Y CLONACIÓN
// =========================================

// 1. Bloquear el clic derecho (menú contextual)
document.addEventListener('contextmenu', event => event.preventDefault());

// 2. Bloquear atajos de teclado de desarrolladores
document.addEventListener('keydown', function(event) {
    // Bloquea F12 (Herramientas de desarrollador)
    if (event.key === 'F12' || event.keyCode === 123) {
        event.preventDefault();
    }
    
    // Bloquea Ctrl+U (Ver código fuente), Ctrl+S (Guardar página), Ctrl+C (Copiar)
    if (event.ctrlKey && (event.key === 'u' || event.key === 'U' || 
                          event.key === 's' || event.key === 'S' || 
                          event.key === 'c' || event.key === 'C')) {
        event.preventDefault();
    }
    
    // Bloquea Ctrl+Shift+I / J / C (Inspeccionar elemento)
    if (event.ctrlKey && event.shiftKey && 
       (event.key === 'I' || event.key === 'i' || 
        event.key === 'J' || event.key === 'j' || 
        event.key === 'C' || event.key === 'c')) {
        event.preventDefault();
    }
});
