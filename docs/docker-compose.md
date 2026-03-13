# docker 编排快速部署使用

本文主要介绍在 aapanel 中可视化操作使用 docker 编排来部署 security 服务的方式

### 1. 下载 security 镜像并导入到 docker

可以从 [release](https://github.com/dc8683/v2board-service-security/releases) 中下载 docker 产物，文件名称为 `airbuddy-security-docker-image-版本号.tar`，也可以在服务器终端使用以下命令直接下载

```bash
  cd /www/wwwroot/security # 进入你希望存放镜像的目录
```

如果不想使用命令，可以在宝塔中打开 docker - 本地镜像，点击导入镜像，选择刚才上传的 `airbuddy-security-docker-image-版本号.tar` 文件，此时镜像列表中会多出一个 `airbuddy-security:版本号` 镜像，如图所示:

![](https://github.com/dc8683/picx-images-hosting/raw/master/docs/Clipboard---2025-06-17-16.34.38.2obsamib0p.webp)

### 2. 创建 docker-compose 文件并配置环境变量

您可以使用 docker 命令或者界面中的创建容器来创建容器，为了各位用户更方便使用，以下提供一份 docker 编排文件，在宝塔中使用容器编排来启动服务，将内容保存为 `docker-compose.yml` 文件，放在你希望运行的目录下，例如： `/www/wwwroot/security`，然后在宝塔中打开终端，执行 `docker compose up -d` 命令来启动服务。

```yaml
version: '3'

services:
  airbuddy-security-service:
    # 替换为你实际的镜像名称和标签
    image: airbuddy-security:1.0.1
    container_name: airbuddy-security-service
    restart: always
    ports:
      # 将容器内部的 3000 端口映射到主机的 12020 端口
      - '12020:3000'
    environment:
      # 以下是环境变量配置，请根据实际情况修改
      - BACKEND_PANEL=v2b # 面板类型，v2b 表示 v2board/xiaoboard 面板，xb 表示 xboard 面板
      - BACKEND_DOMAIN=${DOMAIN} # 面板后端 API 域名
      - SEC_PASSWORD=${PASSWORD} # AES 加密密码，用于加解密，请和前端中的 security.password 保持一致
      # 用于实现免登接口的管理面板配置
      - ADMIN_API_PREFIX=${BACKEND_API_PREFIX} # 面板的后台管理路径
      - ADMIN_EMAIL=${ADMIN_EMAIL} # 面板管理员邮箱
      - ADMIN_PASSWORD=${ADMIN_PASSWORD} # 面板管理员密码
      # 邮件服务配置
      - MAIL_HOST=${MAIL_HOST} # SMTP 邮件服务器地址
      - MAIL_PORT=${MAIL_PORT} # SMTP 邮件服务器端口
      - MAIL_SECURE=${MAIL_SECURE} # 是否使用安全连接
      - MAIL_USER=${MAIL_USER} # SMTP 邮件服务器用户名
      - MAIL_PASS=${MAIL_PASS} # SMTP 邮件服务器密码
      - MAIL_NEWUSER_SUBJECT=${MAIL_NEWUSER_SUBJECT} # 新用户注册邮件主题
      - MAIL_NEWUSER_URL=${MAIL_NEWUSER_URL} # 新用户注册邮件模板链接，用于向新用户发送注册成功和账号密码的通知，需自行创建一个邮件模板文件，并将其放置在 cdn 上，作为链接，设置到 `MAIL_NEWUSER_URL` 环境变量中，如果不设置，将默认采用纯文本模板
      # 图形验证码配置
      - CAPTCHA_KEY=${CAPTCHA_KEY} # 验证码密钥，用于防止恶意提交免登订单攻击
      - CAPTCHA_QUICK_ORDER_ENABLED=true # 是否启用免登创建支付订单验证码，true 或 false
      - CAPTCHA_REGISTER_ENABLED=true # 是否启用注册图形验证码，true 或 false
      - CAPTCHA_LOGIN_ENABLED=true # 是否启用登录图形验证码，true 或 false
    extra_hosts:
      - 'host.docker.internal:host-gateway' # 让容器能访问宿主机（可选）
```

### 3. 添加反向代理站点

服务启动后，在网站 - 反向代理，点击添加反代，域名设置你对外公开的域名，目标 url 填写本机地址 + compose 中的端口号，例如上面compose 对应的端口示例: http://127.0.0.1:12020 , 名称可以随意填写，例如 `airbuddy-security`，然后点击提交即可，如下所示:

![](https://github.com/dc8683/picx-images-hosting/raw/master/docs/fandai.4n7z15bffe.webp)

### 4.查看 security 服务状态

在浏览器中访问 `http://<your-domain>/status`，此页面会显示 security 服务各个模块的运行状态

> Tips: 如果你使用了宝塔的 docker 容器编排功能，可以在宝塔中直接编辑环境变量，还能在宝塔中查看日志，方便调试和维护，如下图所示:
>
> ![](https://github.com/dc8683/picx-images-hosting/raw/master/docs/Clipboard---2025-06-19-00.34.24.6pnrqx732d.webp)
