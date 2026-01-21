# 🕵️ Security Proof: Verify It Yourself

**"Trust, but verify."** — *Russian Proverb*

At Vet-Rate.org, we don't ask you to trust our word that your data is private. We ask you to verify it. This guide will show you exactly how to use standard browser developer tools to prove that **your personal data never leaves your device.**

---

## 🧪 Test 1: The "Silent Runner" Test (Network Traffic)
**Goal:** Prove that typing in your disability ratings or medical info does not send data to a server.

1. **Open Vet-Rate.org** in Google Chrome or Edge.
2. **Open Developer Tools**:
   * Right-click anywhere on the page and select **Inspect**.
   * Or press `F12` (Windows) / `Cmd+Option+I` (Mac).
3. Click the **Network** tab at the top of the developer panel.
4. **Important**: Click the "Clear" icon (🚫) to wipe the current log.
5. **The Test**:
   * Go to the **Tactical Calculator** or **Symptom Logger**.
   * Enter a rating, add a condition, or type a symptom.
   * **Watch the Network tab.**

**✅ What you should see:**
* **Silence.** No new rows should appear in the Network tab as you type or click "Calculate."
* This proves the math logic is running 100% inside your browser's JavaScript engine, not on a remote server.

---

## 🧪 Test 2: The "Vault" Test (Data Storage)
**Goal:** Prove that your data is stored on your hard drive, not in a cloud database.

1. Keep Developer Tools open.
2. Click the **Application** tab (you might need to click `>>` to see it).
3. On the left sidebar, expand **Local Storage** and click on `https://vet-rate.org`.
4. **The Test**:
   * Look for keys like `user_ratings`, `app_settings`, or `my_packet_data`.
   * Modify your data in the main app window (e.g., change a rating from 30% to 50%).

**✅ What you should see:**
* The values in the **Value** column update instantly.
* **Disconnect your internet** (turn off Wi-Fi).
* Refresh the page. Your data is still there.
* This proves the data lives on *your* machine. If we had a database, your data would vanish when you went offline.

---

## 🧪 Test 3: The "AI Consent" Test (Optional Features)
**Goal:** Verify that AI features are opt-in and stripped of personal info.

*Note: This test requires using an AI feature like the "Nexus Builder" or "Decision Decoder."*

1. Go to the **Network** tab again.
2. Trigger an AI feature (e.g., "Analyze My Statement").
3. Look for a network request to: `generativelanguage.googleapis.com` (this is Google's Gemini API).
4. Click on that request and select the **Payload** (or **Request**) tab.

**✅ What you should see:**
* You will see the prompt text being sent.
* **Verify**: Check that your Condition Name is there, but notice that your account ID, email, or IP address are **NOT** part of the prompt payload.

---

## 🚨 Found a Leak?
If you see anything suspicious—data being sent to an unknown URL, or PII included in an AI payload—please report it immediately using the built-in tool.

1. Click the **"Feedback / Report Bug"** button in the application.
2. Select **"Security Vulnerability"** as the category.
3. Attach a screenshot of your Network tab if possible.
