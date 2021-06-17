import { existsSync, readFileSync, writeFileSync } from "fs";
import { basename, resolve } from "path";
import classShuffle from "./modules/class-shuffle";

const modules: RandoModule[] = [
    classShuffle
];

const command = (process.argv[2] || "").toLowerCase();

(function () {
    if (command) {
        let module = modules.find(m => m.command.toLowerCase() == command);
        if (command == "help")
            module = modules.find(m => m.command.toLowerCase() == (process.argv[3] || "").toLowerCase());
        if (module) {
            let filename = process.argv[3];
            if (command == "help" || !filename)
                return console.log(`${module.command}: ${module.helpText}`);
            filename = resolve(filename);
            if (existsSync(filename)) {
                console.log(`Reading file ${filename}...`);
                const result = module.operation(basename(filename), readFileSync(filename), ...process.argv.slice(5));
                console.log(`Replacing contents of file ${filename}...`);
                return writeFileSync(filename, result);
            }
            else
                return console.log(`Could not find file ${filename}`);
        }
    }
    return console.log(`Valid commands are: ${modules.map(m => m.command).join(', ')}.\nType "help" followed by a module name for more information.`);
})();