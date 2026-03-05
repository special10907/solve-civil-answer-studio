---
name: feishu-bot-setup
description: |
  Guide for setting up a Feishu Bot on the Feishu Open Platform (FOP) and connecting it to Flowith Browser.
  Use when user needs to create a Feishu self-built app with bot capabilities, configure permissions,
  set up event subscriptions via persistent connection, and verify the bot can send messages to paired users.
  Triggers on: "飞书机器人", "Feishu Bot", "接入飞书", "配对飞书", "feishu setup", "connect feishu".
  This skill handles Feishu only — never reference or use Lark.
---

# Feishu Bot Setup

Complete Feishu Bot onboarding: create app, configure permissions, connect to Flowith, enable events, publish, and verify messaging.

## Goal

- Create and publish a Feishu self-built app with bot capability.
- Connect it to Flowith Browser via Settings Page.
- Enable event subscriptions and verify the bot can send a confirmation message to a paired user.

## Fixed Entry Points

| Resource | URL |
|----------|-----|
| Feishu Open Platform (FOP) | https://open.feishu.cn/app |
| Settings Page | `flowith://settings` |

## Workflow

Execute steps **strictly in order**. If blocked, self-diagnose and ask one minimal clarifying question before proceeding.

### Step 1: Open FOP and Verify Login

1. Open https://open.feishu.cn/app.
2. If not logged in, prompt the user to log in.
3. Proceed **only** after the user confirms they are logged in.

### Step 2: Create Self-Built App and Add Bot

1. Create a new self-built app (自建应用) on FOP.
2. Navigate to **Add features to your app > By Feature > Bot > Add**.

### Step 3: Configure Permissions

1. Go to **Permissions & Scopes**.
2. Click the **Enable permissions** (开通权限) button. A dialog/panel with a search input will open — the search bar in the page header is **not** the correct entry point.
3. Inside that dialog, paste the following into the search box (comma-separated) to add all at once:

```
im:message, im:message.p2p_msg:readonly, im:message:send_as_bot, im:resource
```

### Step 4: First Publish

1. Go to **Version Management & Release**.
2. Click **Create a version**.
3. Click **Save and Publish** (requires admin approval).

### Step 5: Connect to Flowith

1. Go to **Credentials & Basic Info** on FOP.
2. Copy **App ID** and **App Secret**.
3. Open `flowith://settings` and fill in the corresponding input fields.
4. Click **Connect**.
5. Proceed **only** after the connection succeeds.

### Step 6: Configure Event Subscription Mode

1. On FOP, navigate to **Events & Callbacks > Event configuration > Subscription mode**.
2. Click **Edit** (编辑).
3. Select **Receive events through persistent connection** (使用长连接接收事件).
4. Click **Save**.

### Step 7: Add Events

In the same Events & Callbacks section, click **Add Events** and search for:

- `im.message.receive_v1`
- `p2p_chat_create`

### Step 8: Second Publish

1. Go to **Version Management & Release**.
2. Click **Create a version**.
3. Click **Save and Publish** (requires admin approval).

### Step 9: Verify

After admin approval:

1. Confirm the setup is complete.
2. Tell the user the bot name so they can search for it in Feishu and send a test message.
