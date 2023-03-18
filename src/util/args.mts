import yargs from "yargs";
import { hideBin } from "yargs/helpers";

type Args = {
    chromeExecutePath?: string;
    target: string;
    headless: boolean;
    p: number;
};

export default async function args(argv: string[]): Promise<Args> {
    const parsed = await yargs(hideBin(argv)).argv;

    return {
        chromeExecutePath: parsed.chromeExecutePath as string,
        headless: (parsed.headless as boolean) ?? false,
        target: parsed.target as string,
        p: (parsed.p as number) ?? 1,
    };
}
