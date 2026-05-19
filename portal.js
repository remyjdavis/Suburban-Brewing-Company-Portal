// --- 1. THE GATEKEEPER (Security & Boss Mode) ---
(function() {
    // A. CHECK FOR MAGIC KEY (URL)
    const params = new URLSearchParams(window.location.search);
    if (params.get("key") === "boss") {
        localStorage.setItem("sbc_auth", "true");
        localStorage.setItem("user_name", "Eric Yost");
        localStorage.setItem("user_role", "Owner");
        localStorage.setItem("user_title", "Owner");
        localStorage.setItem("sbc_driver_name", "Eric Yost");
        // Note: URL cleaning removed so key stays in bookmark
    }

    // B. BOSS MEMORY CHECK (Centralized Boss Mode)
    // If the phone remembers he is the Owner, auto-login immediately.
    if (localStorage.getItem("user_role") === "Owner") {
        localStorage.setItem("sbc_auth", "true");
        sessionStorage.setItem("sbc_auth", "true");
    } 

    // C. SECURITY CHECK
    const auth = localStorage.getItem("sbc_auth") === "true" || sessionStorage.getItem("sbc_auth") === "true";
    const isLoginPage = window.location.pathname.endsWith("index.html") || window.location.pathname.endsWith("/") || window.location.pathname.includes("login.html");
    
    if (!auth && !isLoginPage) {
        // Only redirect if NOT the boss
        window.location.href = "/Suburban-Brewing-Company-Portal/login.html";
    }
})();

// --- CONFIGURATION ---
const MASTER_API_URL = "https://script.google.com/macros/s/AKfycbzzkG7_Def-aiH-cF_m0NrdJe53WqQEqRDPa4Fa0nQz9-tu7kII6XmU29N3fe5T6UDF/exec"; 
const PORTAL_ROOT = "https://remyjdavis.github.io/Suburban-Brewing-Company-Portal/";

// --- 2. GLOBAL INITIALIZATION ---
window.addEventListener('load', () => {
    setupUserProfile();
    requestNotifyPermission(); // 🟢 Step 1: Ask browser for permission
    
    // Initial Checks
    checkUnreadCount(); 
    checkBusinessActivity(); // 🟢 Step 2: Check Invoices/Orders/Comments immediately
    setupHubReturn();
    updateHubIdentity();

    // Poll every 60 seconds
    setInterval(() => {
        checkUnreadCount();
        checkBusinessActivity();
    }, 60000);
});

// --- 3. NOTIFICATION SYSTEM (Frontend Logic) ---

// A. Request Permission
function requestNotifyPermission() {
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
}

// B. Trigger Notification (Browser + Toast)
function sendPortalNotification(title, body) {
    // 1. Browser Native Notification (Background)
    if (Notification.permission === "granted") {
        new Notification(title, { 
            body: body, 
            icon: PORTAL_ROOT + "logo.png" 
        });
    }
    
    // 2. In-App Toast (Foreground)
    const Toast = Swal.mixin({
        toast: true, position: 'top-end', 
        showConfirmButton: false, timer: 5000, timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });
    Toast.fire({ icon: 'info', title: title, text: body });
}

// C. Poll for Invoices, Orders, Comments
// 3. MAIN LOOP: Checks everything
async function checkBusinessActivity() {
    try {
        const res = await fetch(`${MASTER_API_URL}?action=getActivityFeed`);
        const data = await res.json();

        // A. INVOICE ALERT
        if (data.latestInvoice) {
            const lastInv = localStorage.getItem("last_inv_id");
            // Check if ID is new (compare as strings to be safe)
            if (String(data.latestInvoice.id) !== lastInv) {
                localStorage.setItem("last_inv_id", data.latestInvoice.id);
                sendPortalNotification("🧾 New Invoice Generated", `#${data.latestInvoice.id} for ${data.latestInvoice.customer}`);
            }
        }

        // B. WEB ORDER ALERT (Updated to use Customer Name)
        if (data.latestOrder) {
            const lastOrd = localStorage.getItem("last_order_id");
            if (String(data.latestOrder.id) !== lastOrd) {
                localStorage.setItem("last_order_id", data.latestOrder.id);
                // 🔴 UPDATED: Uses .customer instead of .items
                sendPortalNotification("🛒 New Web Order", `Order #${data.latestOrder.id} from ${data.latestOrder.customer}`);
            }
        }

        // C. MARKETING ALERT
        if (data.latestComment) {
            const lastComm = localStorage.getItem("last_comment_id");
            if (String(data.latestComment.id) !== lastComm) {
                localStorage.setItem("last_comment_id", data.latestComment.id);
                sendPortalNotification("💬 Marketing Comment", `${data.latestComment.author} on "${data.latestComment.post}": ${data.latestComment.text}`);
            }
        }

    } catch (e) { console.warn("Activity sync silent fail"); }
}

// --- 4. MESSAGING SYSTEM (Enhanced) ---
// 🟢 ALSO FIX THE UNREAD BADGE COUNTER
async function checkUnreadCount() { 
    try { 
        // Must use the exact same username check!
        const activeUser = localStorage.getItem("user_name") || 
                           sessionStorage.getItem("user_name") || 
                           document.getElementById("display-username")?.innerText || 
                           "Unknown User";

        const url = `${MASTER_API_URL}?action=getInbox&type=inbox&user=${encodeURIComponent(activeUser)}&t=${new Date().getTime()}`;
        
        const res = await fetch(url); 
        const responseData = await res.json(); 
        
        const msgArray = Array.isArray(responseData) ? responseData : (responseData.messages || []);
        
        if (msgArray.length > 0) { 
            const unreadMessages = msgArray.filter(m => 
                (m.direction === 'Inbound' || !String(m.id).startsWith("SENT-")) && 
                m.status === 'Unread'
            ); 
            
            updateBadgeUI(unreadMessages.length); 

            if (unreadMessages.length > 0) {
                unreadMessages.sort((a, b) => new Date(b.date) - new Date(a.date));
                const newestMsg = unreadMessages[0]; 
                const lastMsgId = localStorage.getItem("last_msg_alert");

                if (newestMsg.id !== lastMsgId) {
                    localStorage.setItem("last_msg_alert", newestMsg.id);
                    
                    const textContent = newestMsg.text || newestMsg.body || "";
                    const bodyText = textContent.length > 60 ? textContent.substring(0, 60) + "..." : textContent;
                    const sender = newestMsg.user || newestMsg.from || "Someone";
                    
                    sendPortalNotification(`New Message from ${sender}`, bodyText);
                }
            }
        } else {
            updateBadgeUI(0);
        }
    } catch(e) { 
        console.error("Inbox sync error:", e); 
    } 
}
function updateBadgeUI(count) { 
    const dO = document.getElementById('msg-badge'); 
    const dI = document.getElementById('dropdown-badge'); 
    const mH = document.getElementById('header-badge'); 
    
    if (count > 0) { 
        if(dO) { dO.innerText = count > 9 ? '9+' : count; dO.style.display = 'flex'; } 
        if(dI) { dI.innerText = count; dI.style.display = 'inline-block'; } 
        if(mH) { mH.innerText = count > 9 ? '!' : count; mH.style.display = 'flex'; } 
    } else { 
        if(dO) dO.style.display = 'none'; 
        if(dI) dI.style.display = 'none'; 
        if(mH) mH.style.display = 'none'; 
    } 
}


window.readMessage = async function(id, user, email, topic, text) {
    // 1. Mark as Read and get the result
    const res = await fetch(MASTER_API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'markRead', id: id })
    });
    const result = await res.json();
    
    // 2. Fetch the updated message to get the Read Timestamp
    // (Optional: You can add a 'getSingleMessage' function to fetch the timestamp specifically)

    Swal.fire({
        title: `Message from ${user}`,
        html: `<div style="text-align:left; font-size:14px;">
                <p><strong>Subject:</strong> ${topic}</p>
                <div style="background:#f8fafc; padding:10px; border-radius:5px;">${text}</div>
                <p style="font-size:11px; color:#64748b; margin-top:10px;">
                   Read on: ${new Date().toLocaleString()}
                </p>
               </div>`,
        confirmButtonText: "Close"
    }).then(() => openInbox()); 
}

// --- 4. MESSAGING SYSTEM (ENHANCED) ---
// --- THE ONLY VERSION OF openInbox YOU NEED ---
window.openInbox = async function(folder = 'inbox') {
    // 1. Get identity (Bulletproof)
    const activeUser = localStorage.getItem("user_name") || 
                       sessionStorage.getItem("user_name") || 
                       document.getElementById("display-username")?.innerText || 
                       "Unknown User";

    const d = document.getElementById("userDropdown");
    if(d) d.classList.remove("show");
    
    Swal.fire({ title: 'Loading...', didOpen: () => Swal.showLoading() });
    
    try {
        const url = `${MASTER_API_URL}?action=getInbox&type=${folder}&user=${encodeURIComponent(activeUser)}&t=${new Date().getTime()}`;
        const res = await fetch(url);
        const responseData = await res.json();
        
        // Ensure messages is an array
        const msgArray = Array.isArray(responseData) ? responseData : (responseData.messages || []);
        
        let html = `
            <div style="margin-bottom:10px;">
                <button onclick="openInbox('inbox')" class="swal2-styled" style="background:${folder==='inbox'?'#2563eb':'#cbd5e1'}">📥 Inbox</button>
                <button onclick="openInbox('sent')" class="swal2-styled" style="background:${folder==='sent'?'#2563eb':'#cbd5e1'}">📤 Sent</button>
            </div>
            <div style="max-height:350px; overflow-y:auto; border:1px solid #eee; border-radius:8px; text-align:left;">`;
        
        if (msgArray.length > 0) {
            msgArray.forEach(m => {
                const displayUser = folder === 'inbox' ? (m.user || m.from || 'Unknown') : (m.recipient || m.to || m.user || 'Unknown');
                const displayTopic = m.topic || m.subject || 'No Subject';
                const displayText = m.text || m.body || '';

                html += `
                <div style="background:${m.status === "Unread" ? "#f0f9ff" : "#fff"}; padding:10px; border-bottom:1px solid #eee; cursor:pointer;" 
                     onclick="readMessage('${m.id}', '${displayUser}', '${displayUser}', '${displayTopic}', \`${displayText.replace(/`/g, "'")}\`)">
                    <div style="display:flex; justify-content:space-between; font-size:11px; color:#64748b;">
                        <span>${new Date(m.date).toLocaleDateString()}</span>
                        <span style="color:${m.status === 'Read' ? '#10b981' : '#f59e0b'}">${m.status}</span>
                    </div>
                    <div style="font-weight:600;">${folder === 'inbox' ? 'From: ' : 'To: '} ${displayUser}</div>
                    <div style="font-size:12px;">${displayTopic}</div>
                </div>`;
            });
        } else {
            html += '<div style="padding:20px; text-align:center;">Folder is empty.</div>';
        }
        html += '</div>';
        
        // Button that now calls your fixed openComposeModal
        html += `<button onclick="openComposeModal()" class="swal2-confirm swal2-styled" style="width:100%; margin-top:15px; background-color:#10b981;">+ New Message</button>`;
        
        Swal.fire({ title: 'Messages', width: '600px', html: html, showConfirmButton: false, showCloseButton: true });
    } catch(e) { 
        Swal.fire('Error', 'Could not load messages.', 'error'); 
        console.error(e); 
    }
}
// --- 5. UI UTILITIES ---
function setupUserProfile() {
    const name = localStorage.getItem("user_name") || sessionStorage.getItem("user_name") || "User";
    const title = localStorage.getItem("user_title") || sessionStorage.getItem("user_title") || "Staff";
    const pic = localStorage.getItem("user_pic") || sessionStorage.getItem("user_pic") || PORTAL_ROOT + "Logo.png";
    const role = localStorage.getItem("user_role") || sessionStorage.getItem("user_role");

    if(document.getElementById("display-username")) document.getElementById("display-username").innerText = name;
    if(document.getElementById("display-role")) document.getElementById("display-role").innerText = title;
    if(document.getElementById("display-avatar")) {
        const img = document.getElementById("display-avatar");
        img.src = pic;
        img.onerror = function() { this.src = PORTAL_ROOT + "logo.png"; };
    }

    const adminDiv = document.getElementById("admin-nav-link");
    if (adminDiv) {
        if (role === "Admin" || role === "Owner") {
            adminDiv.style.display = "block";
            const link = adminDiv.querySelector('a');
            if (link) {
                const isSubfolder = window.location.pathname.includes("/Brewing/") || window.location.pathname.includes("/sales/") || window.location.pathname.includes("/inventory/");
                link.href = isSubfolder ? "../Admin.html" : "Admin.html";
            }
        } else {
            adminDiv.style.display = "none";
        }
    }

    const dropdown = document.getElementById("userDropdown");
    if (dropdown && dropdown.innerHTML.trim() === "") {
        dropdown.innerHTML = `
            <a href="#" onclick="openInbox(); toggleUserMenu(event);" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span>📩 Team Inbox</span>
                <span id="dropdown-badge" style="display: none; background: #ef4444; color: white; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 10px;">0</span>
            </a>
            <a href="#" onclick="updateUserInfo(); toggleUserMenu(event);">⚙️ Update Info</a>
            <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
            <a href="#" onclick="handleLogout()" style="color: #ef4444;">🚪 Logout</a>
        `;
    }
}

window.toggleUserMenu = function(e) { if(e) e.stopPropagation(); const d = document.getElementById("userDropdown") || document.getElementById("userMenu"); if(d) d.classList.toggle("show"); }
window.onclick = function(event) { if (!event.target.closest('.user-profile') && !event.target.closest('.dropdown-menu')) { const d = document.getElementById("userDropdown") || document.getElementById("userMenu"); if (d && d.classList.contains('show')) d.classList.remove('show'); } }
window.handleLogout = function() { sessionStorage.clear(); localStorage.removeItem("sbc_auth"); localStorage.removeItem("user_name"); localStorage.removeItem("user_role"); window.location.replace(PORTAL_ROOT + "login.html"); }

function updateHubIdentity() {
    const roleForHub = localStorage.getItem("user_role") || "Staff";
    const nameForHub = localStorage.getItem("user_name") || "User";
    const hubRoleElement = document.getElementById("menu-user-role");
    const hubNameElement = document.getElementById("menu-user-name");
    if (hubRoleElement) { hubRoleElement.innerText = roleForHub; hubRoleElement.style.visibility = "visible"; }
    if (hubNameElement) { hubNameElement.innerText = nameForHub; }
}

function setupHubReturn() {
    if (window.innerWidth > 1024) return; 
    const isHub = window.location.pathname.endsWith("/") || window.location.pathname.includes("index.html");
    const isLogin = window.location.pathname.includes("login.html");
    if (isHub) sessionStorage.setItem("sbc_hub_mode", "active");
    if (!isHub && !isLogin && sessionStorage.getItem("sbc_hub_mode") === "active") {
        const btn = document.createElement("button");
        btn.innerHTML = "⬅ Hub";
        btn.style.cssText = `position: fixed; bottom: 20px; left: 20px; z-index: 10000; background-color: #ef4444; color: white; padding: 10px 18px; border-radius: 30px; border: none; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.3); cursor: pointer; font-family: system-ui, -apple-system, sans-serif; font-size: 14px;`;
        btn.onclick = function() { window.location.href = (typeof PORTAL_ROOT !== 'undefined' ? PORTAL_ROOT : "../") + "index.html"; };
        document.body.appendChild(btn);
    }
}
