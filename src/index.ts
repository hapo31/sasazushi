import puppeteer from "puppeteer";
import mkdirp from "mkdirp";
import path from "path";

const shoutaNoSushiIndexUrl = "https://www.sukima.me/book/title/rigths0000003/";

const saveRootDir = path.join("./dist");

(async () => {
    console.log("starting...");
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--lang=ja,en-US,en"]
    });
    const page = await browser.newPage();
    await page.goto(shoutaNoSushiIndexUrl, { waitUntil: "domcontentloaded" });

    console.log("went to " + shoutaNoSushiIndexUrl);
    await page.waitForSelector(".booktitle-volume-list");

    const episodeAnchorList = await page.$$(".volume-details > a");

    if (episodeAnchorList != null) {
        const links: string[] = await Promise.all(
            episodeAnchorList.map(
                async a => await (await a.getProperty("href")).jsonValue()
            )
        );

        // テスト用に1ページだけ
        // await takeEpisodeScreenshots(browser, links[0]);

        let index = 0;
        // 本番
        for (const url of links) {
            await takeEpisodeScreenshots(browser, url, index);
            ++index;
        }
    }

    await browser.close();
})();

async function takeEpisodeScreenshots(
    browser: puppeteer.Browser,
    url: string,
    directoryPrefixIndex: number,
    size?: { witdh: number; height: number }
) {
    const page = await browser.newPage();
    if (size) {
        await page.setViewport({ width: size.witdh, height: size.height });
    } else {
        await page.setViewport({ width: 768, height: 1210 });
    }

    await page.goto(url, { waitUntil: "domcontentloaded" });

    // 広告を閉じる
    const ad = await page.$(".popupad-close");
    if (ad) {
        await ad.click();
    }

    // ページ上に掛かっているコントローラーを消す
    const rightBlankPage = await page.$("#canvas_1");

    if (rightBlankPage) {
        await rightBlankPage.click();
    }

    // コントローラーが消えるまで待つ
    await page.waitFor(500);

    const fullTitle = await page.title();

    const title = fullTitle.split("｜")[0];

    console.log(title);

    const comicPath = path.join(
        saveRootDir,
        `${directoryPrefixIndex}_${title}`
    );

    mkdirp.sync(comicPath);

    // ページ番号のIDは 1 オリジン
    let pageIndex = 1;
    while (true) {
        const divId = `#canvas_${pageIndex}`;

        const canvasIncludeDiv = await page.$(divId);

        if (canvasIncludeDiv) {
            const filePath =
                path.join(comicPath, pageIndex.toString()) + ".png";
            console.log(`   page:${filePath}`);
            await canvasIncludeDiv.screenshot({
                path: filePath,
                type: "png"
            });
        } else {
            // element が取れなかったら終了する
            break;
        }

        const nextBtn = await page.$("#btn-next");
        if (nextBtn) {
            await nextBtn.click();
        }
        // ページが切り替わるまで待つ
        await page.waitFor(200);
        pageIndex += 1;
    }

    return await page.close();
}
