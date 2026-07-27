# Scholarium —— 高校教师主页信息采集工具

Scholarium 是一款 **教师个人主页信息批量采集工具**。输入教师主页 URL 列表，自动提取教师简介与联系方式，并导出为 Excel 表格。

## 功能特性

- **Web 图形界面** —— 浏览器内操作，无需命令行
- **批量采集** —— 支持多 URL 同时提交，逐条抓取
- **邮箱提取** —— 自动识别页面中的教师邮箱地址
- **简介提取** —— 智能提取教师个人简介正文，过滤导航、公告等无关内容
- **Excel 导出** —— 按需一键导出 `.xlsx` 表格

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3 + Flask |
| 前端 | 原生 HTML / CSS / JavaScript（SSE 实时推送） |
| 解析 | BeautifulSoup4 + lxml + trafilatura |
| 输出 | openpyxl（Excel） |
| PDF 提取 | pdfplumber |

## 开始

根据你的操作系统，选择对应的启动方式：

| 系统 | 启动方式 |
|------|----------|
| **macOS / Linux** | 终端运行 `./Launcher.sh`，详见对应release的 [README.md] |
| **Windows** | 双击 `Launcher.bat`，详见对应release的 [README.md] |

启动后浏览器自动打开 `http://127.0.0.1:5080`，粘贴教师主页 URL 即可开始采集。

## 依赖

```
requests>=2.31.0
flask>=3.0.0
beautifulsoup4>=4.12.0
lxml>=5.1.0
lxml_html_clean
openpyxl>=3.1.0
trafilatura>=1.8.0
certifi>=2024.0.0
pdfplumber>=0.10.0
```

启动脚本会自动检测并安装缺失依赖，无需手动操作。

## License
本项目仅供学习与研究使用。请仅用于合法用途，遵守目标网站的 robots.txt 和使用条款。本项目仅采集教师在主页公开的信息，不会采集非公开信息。
