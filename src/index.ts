import puppeteer from "puppeteer";

const shoutaNoSushiIndexUrl = "https://www.sukima.me/book/title/rigths0000003/";

(async () => {
    console.log("starting...");
    const browser = await puppeteer.launch({
        headless: false,
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
        await getEpisodeScreenshots(browser, links[0]);

        // 本番
        // for (const url of links) {
        //     // 負担を掛けないように3秒待つ
        //     await page.waitFor(3000);
        //     await getEpisodeScreenshots(browser, url);
        // }
    }

    await browser.close();
})();

async function getEpisodeScreenshots(
    browser: puppeteer.Browser,
    url: string,
    size?: { witdh: number; height: number }
) {
    const page = await browser.newPage();
    if (size) {
        await page.setViewport({ width: size.witdh, height: size.height });
    }

    await page.goto(url, { waitUntil: "domcontentloaded" });

    // 広告を閉じる
    const ad = await page.$(".popupad-close");
    if (ad) {
        await ad.click();
    }

    // ページ上に掛かっているコントローラーを消す
    const rightBlankPage = await page.$("#canvas_blank_before_1");

    if (rightBlankPage) {
        await rightBlankPage.click();
    }
}
