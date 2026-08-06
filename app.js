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

    // --- 2. Carga de Datos desde JSON (Productos y Configuración) ---
    // Usamos getTime() para evitar que el navegador guarde los archivos en caché y siempre muestre los nuevos productos
    const cacheBuster = new Date().getTime();
    
    // Función: asigna categoría usando reglas primero, luego primera palabra como fallback
    function getCategoriaConReglas(nombreProducto, reglas) {
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
            const categoriaAsignada = getCategoriaConReglas(product.nombre, reglasCategoria);
            return {
                ...product,
                categoria_original: product.categoria,
                categoria: categoriaAsignada
            };
        });

        // Ordenar inicialmente todos los productos por precio de menor a mayor
        allProducts.sort((a, b) => a.precio - b.precio);
        currentFilteredProducts = [...allProducts];

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
            showNewProductsBanner(newProductCodes.size);
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

    // --- 3. Renderizado de Productos ---
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

        productsToRender.forEach((product, index) => {
            const card = document.createElement('div');
            card.classList.add('product-card');
            
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

            // 1. Verificar promoción individual del producto (nueva lógica JSON)
            if (product.tiene_promocion && product.promocion) {
                const promo = product.promocion;
                const min = promo.cantidad_minima || 1;
                
                if (min > 1) {
                    promoBadge = `<div style="position: absolute; top: 12px; right: 12px; background: #8b5cf6; color: white; padding: 0.3rem 0.8rem; border-radius: 50px; font-size: 0.75rem; font-weight: 800; z-index: 10; box-shadow: 0 4px 10px rgba(139, 92, 246, 0.4);">¡MEGA OFERTA!</div>`;
                    priceHtml = `<div style="display:flex; flex-direction:column; line-height: 1.3;">
                                    <span style="font-size: 0.85rem; color: #64748b; text-decoration: line-through;">Normal: $${product.precio.toFixed(2)} c/u</span>
                                    <span style="font-size: 0.85rem; color: #8b5cf6; font-weight: 800;">Desde ${min} unid: $${promo.precio_especial.toFixed(2)} c/u</span>
                                 </div>`;
                } else {
                    finalPrice = promo.precio_especial;
                    promoBadge = `<div style="position: absolute; top: 12px; right: 12px; background: #ef4444; color: white; padding: 0.3rem 0.8rem; border-radius: 50px; font-size: 0.75rem; font-weight: 800; z-index: 10; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.4);">¡OFERTA!</div>`;
                    priceHtml = `<span style="text-decoration: line-through; opacity: 0.5; font-size: 0.9rem; margin-right: 0.5rem;">$${product.precio.toFixed(2)}</span><span style="color: #ef4444;">$</span><span style="color: #ef4444;">${finalPrice.toFixed(2)}</span>`;
                }
            } 
            // 2. Verificar promoción antigua de config.json
            else if (configData.promocion_activa && configData.promociones) {
                const promo = configData.promociones.find(p => String(p.codigo_producto) === String(product.codigo) && p.activa !== false);
                if (promo) {
                    if (promo.solo_lista) {
                        promoBadge = `<div style="position: absolute; top: 12px; right: 12px; background: #f59e0b; color: white; padding: 0.3rem 0.8rem; border-radius: 50px; font-size: 0.75rem; font-weight: 800; z-index: 10; box-shadow: 0 4px 10px rgba(245, 158, 11, 0.4);">¡PROMO LISTA!</div>`;
                        priceHtml = `<div style="display:flex; flex-direction:column; line-height: 1.2;">
                                        <span>$${product.precio.toFixed(2)}</span>
                                        <span style="font-size:0.75rem; color:#f59e0b; font-weight: 600;">(Por lista: $${promo.precio_promocional.toFixed(2)})</span>
                                     </div>`;
                    } else {
                        finalPrice = promo.precio_promocional || product.precio;
                        promoBadge = `<div style="position: absolute; top: 12px; right: 12px; background: #ef4444; color: white; padding: 0.3rem 0.8rem; border-radius: 50px; font-size: 0.75rem; font-weight: 800; z-index: 10; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.4);">¡PROMO!</div>`;
                        priceHtml = `<span style="text-decoration: line-through; opacity: 0.5; font-size: 0.9rem; margin-right: 0.5rem;">$${product.precio.toFixed(2)}</span><span style="color: #ef4444;">$</span><span style="color: #ef4444;">${finalPrice.toFixed(2)}</span>`;
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
            
            // Evento para visualizar la imagen en grande
            const imgContainerEl = card.querySelector('.product-image-container');
            imgContainerEl.style.cursor = 'zoom-in';
            imgContainerEl.addEventListener('click', () => {
                const imageModal = document.getElementById('imageModal');
                const expandedImg = document.getElementById('expandedImg');
                const nameEl = document.getElementById('expandedProductName');
                const codeEl = document.getElementById('expandedProductCode');
                if (imageModal && expandedImg) {
                    expandedImg.src = imgSrc;
                    if (nameEl) nameEl.textContent = product.nombre;
                    if (codeEl) codeEl.textContent = `CÓD: ${product.codigo}`;
                    
                    const watermarkEl = document.getElementById('expandedWatermark');
                    if (watermarkEl) {
                        const rRotate = Math.floor(Math.random() * 30) - 45; // -45 a -15 grados
                        watermarkEl.textContent = configData.nombre_tienda || 'Tatynet';
                        watermarkEl.style.transform = `translate(-50%, -50%) rotate(${rRotate}deg)`;
                    }

                    imageModal.classList.add('active');
                }
            });


            // Evento para añadir al carrito
            const buyBtn = card.querySelector('.btn-buy');
            buyBtn.addEventListener('click', () => {
                const isNewItem = addToCart(product);
                
                // Animación de botón
                const originalText = buyBtn.innerHTML;
                const originalBg = buyBtn.style.background;
                const originalColor = buyBtn.style.color;
                
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
                }, 1500);
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

    // --- 5. Lógica de Filtrado (Búsqueda + Categoría) ---
    function filterProducts() {
        const searchTermStr = normalizeString(searchInput.value).trim();
        const searchTerms = searchTermStr ? searchTermStr.split(/\s+/) : [];
        const activeCategoryBtn = document.querySelector('#categoryFilters .filter-btn.active');
        const activeCategory = activeCategoryBtn ? activeCategoryBtn.dataset.category : 'Todos';

        currentFilteredProducts = allProducts.filter(product => {
            const productName = normalizeString(product.nombre);
            const productCategory = normalizeString(product.categoria);
            const productDesc = normalizeString(product.descripcion);
            const productCode = normalizeString(String(product.codigo));
            
            const searchableText = `${productName} ${productCategory} ${productDesc} ${productCode}`;
            
            let matchesSearch = true;
            if (searchTerms.length > 0) {
                matchesSearch = searchTerms.every(term => searchableText.includes(term));
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

    // Event listeners para la búsqueda en tiempo real
    searchInput.addEventListener('input', (e) => {
        if (e.isTrusted && categorySearchInput && categorySearchInput.value !== '') {
            categorySearchInput.value = '';
            categorySearchInput.dispatchEvent(new Event('input'));
        }

        // UX: Búsqueda Global Automática
        // Si el usuario empieza a buscar, cambiamos la categoría a "Todos" para que no le salgan 0 resultados por estar en una categoría restrictiva.
        if (e.isTrusted && searchInput.value.trim() !== '') {
            const currentActive = document.querySelector('#categoryFilters .filter-btn.active');
            if (currentActive && currentActive.dataset.category !== 'Todos') {
                currentActive.classList.remove('active');
                const btnTodos = document.querySelector('#categoryFilters .filter-btn[data-category="Todos"]');
                if (btnTodos) btnTodos.classList.add('active');
            }
        }

        filterProducts();
    });

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

    function addToCart(product) {
        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            existingItem.quantity += 1;
            saveCart();
            updateCartUI();
            showToast(`<i class="fas fa-info-circle" style="color: #3b82f6;"></i> Cantidad actualizada en carrito`);
            return false;
        } else {
            cart.push({ ...product, quantity: 1 });
            saveCart();
            updateCartUI();
            showToast(`<i class="fas fa-check-circle" style="color: #4ade80;"></i> ${product.nombre} añadido`);
            return true;
        }
    }

    function showToast(message) {
        toast.innerHTML = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2500);
    }

    function removeFromCart(productId) {
        cart = cart.filter(item => item.id !== productId);
        saveCart();
        updateCartUI();
    }

    function changeQuantity(productId, delta) {
        const item = cart.find(i => i.id === productId);
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
                let priceHtml = `$${item.precio.toFixed(2)}`;
                let appliedPromo = false;
                let promoColor = '#ef4444';

                // 1. Promoción Individual (nueva lógica JSON)
                if (item.tiene_promocion && item.promocion) {
                    const promo = item.promocion;
                    const min = promo.cantidad_minima || 1;
                    if (item.quantity >= min) {
                        finalItemPrice = promo.precio_especial;
                        appliedPromo = true;
                        promoColor = min > 1 ? '#8b5cf6' : '#ef4444';
                    }
                } 
                // 2. Promoción Global (config.json)
                else if (configData.promocion_activa && configData.promociones) {
                    const promo = configData.promociones.find(p => String(p.codigo_producto) === String(item.codigo) && p.activa !== false);
                    if (promo && promo.precio_promocional) {
                        if (!promo.solo_lista || (promo.solo_lista && isPromoList)) {
                            finalItemPrice = promo.precio_promocional;
                            appliedPromo = true;
                            promoColor = promo.solo_lista ? '#f59e0b' : '#ef4444';
                        }
                    }
                }

                if (appliedPromo) {
                    priceHtml = `<span style="text-decoration: line-through; opacity: 0.5; font-size: 0.8rem; margin-right: 0.3rem;">$${item.precio.toFixed(2)}</span><span style="color: ${promoColor}; font-weight: 800;">$${finalItemPrice.toFixed(2)}</span>`;
                    
                    if (item.tiene_promocion && item.promocion && item.promocion.cantidad_minima > 1 && item.quantity >= item.promocion.cantidad_minima) {
                        priceHtml += `<div style="font-size: 0.7rem; color: ${promoColor}; margin-top: 2px;"><i class="fas fa-tag"></i> Descuento por volumen aplicado</div>`;
                    }
                }

                item.cartDisplayPrice = finalItemPrice; // Guardar para calcular total

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
                btn.addEventListener('click', (e) => changeQuantity(parseInt(e.target.dataset.id), -1));
            });
            cartItemsContainer.querySelectorAll('.plus').forEach(btn => {
                btn.addEventListener('click', (e) => changeQuantity(parseInt(e.target.dataset.id), 1));
            });
            cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(btn => {
                btn.addEventListener('click', (e) => removeFromCart(parseInt(e.currentTarget.dataset.id)));
            });
        }

        // Actualizar el total monetario
        const total = cart.reduce((sum, item) => sum + ((item.cartDisplayPrice || item.precio) * item.quantity), 0);
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
            const finalPrice = item.cartDisplayPrice || item.precio;
            let qtyNote = "";
            if (item.cartDisplayPrice && item.cartDisplayPrice < item.precio) {
                qtyNote = " (Promo aplicada)";
            }
            message += `- ${item.quantity}x ${item.nombre} (CÓD: ${item.codigo}) [$${(finalPrice * item.quantity).toFixed(2)}]${qtyNote}%0A`;
        });
        
        const total = cart.reduce((sum, item) => sum + ((item.cartDisplayPrice || item.precio) * item.quantity), 0);
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
