import NARChive from "../lib/NARChive";

const specialClasses = [10, 11, 12, 19, 20, 21, 22, 23, 37, 38, 40, 47, 54, 55, 56, 78, 79, 80, 81, 82, 88, 89, 97, 100, 101, 102];

type ClassIdMapping = {
    classId: number;
    trainerId: number;
}

enum ShuffleMode {
    "shuffle-isolate",
    "shuffle-all",
    "shuffle-keep-special",
    "random-isolate",
    "random-all",
    "random-keep-special"
}

function operation(_: string, file: Buffer, mode?: string): Buffer {
    const shuffleMode: ShuffleMode = ShuffleMode[(mode || "").toLowerCase()] || ShuffleMode["shuffle-isolate"];
    console.log(`Class Shuffler: Mode ${ShuffleMode[shuffleMode]}`);

    const narc = new NARChive(file);

    const trainerClassIds = narc.files.map((data, i) => ({
        classId: data[1],
        trainerId: i
    }));
    let normalTrainers = trainerClassIds.filter(t => !isSpecialTrainer(t.classId));
    let specialTrainers = trainerClassIds.filter(t => isSpecialTrainer(t.classId));

    console.log(`Found ${trainerClassIds.length} trainers, ${normalTrainers.length} normal and ${specialTrainers.length} special.`);

    switch (ShuffleMode[shuffleMode]) {
        case "shuffle-all":
            specialTrainers = []; // No trainers are special
        case "shuffle-keep-special":
            normalTrainers = trainerClassIds; // normal trainers can become special
        case "shuffle-isolate":
        default:
            console.log("Shuffling trainer classes...");
            normalTrainers = shuffleAndRemap(shallowClone(normalTrainers));
            specialTrainers = shuffleAndRemap(shallowClone(specialTrainers));
            break;

        case "random-all":
            specialTrainers = [];
        case "random-keep-special":
            normalTrainers = trainerClassIds;
        case "random-isolate":
            console.log("Randomizing trainer classes...");
            normalTrainers = randomRemap(shallowClone(normalTrainers));
            specialTrainers = randomRemap(shallowClone(specialTrainers));
            break;
    }

    const remapped = [
        ...specialTrainers,
        ...normalTrainers.filter(nt => !specialTrainers.some(st => st.trainerId == nt.trainerId)) //filter pre-existing special trainers out of normal trainer data in case they were merged back in
    ];

    // Reload arrays so counts can be updated
    normalTrainers = remapped.filter(t => !isSpecialTrainer(t.classId));
    specialTrainers = remapped.filter(t => isSpecialTrainer(t.classId));

    narc.files.forEach((data, i) => {
        const oldClass = data[1];
        const newClass = (remapped.find(t => t.trainerId == i) || { trainerId: i, classId: oldClass }).classId;
        data[1] = newClass;
        console.log(`Trainer ${i}: ${oldClass} -> ${newClass} ${isSpecialTrainer(oldClass) ? isSpecialTrainer(newClass) ? "=STAYED SPECIAL=" : "-WAS SPECIAL=" : isSpecialTrainer(newClass) ? "+MADE SPECIAL+" : ""}`);
    });
    console.log(`Updated ${remapped.length} trainers, now ${normalTrainers.length} normal and ${specialTrainers.length} special.`);

    return narc.getBytes();
}

function isSpecialTrainer(cId: number) {
    return specialClasses.indexOf(cId) >= 0;
}

function shallowClone<T = {}>(array: T[]) {
    return array.map(a => ({ ...a }));
}

function randomRemap(array: ClassIdMapping[]) {
    const validValues = array.map(a => a.classId).filter((c, i, arr) => arr.indexOf(c) == i); //make a list of all distinct class ids
    array.forEach(a => a.classId = validValues[Math.floor(Math.random() * validValues.length)]);
    return array;
}

function shuffleAndRemap(array: ClassIdMapping[]) {
    const tIds = array.map(entry => entry.trainerId);
    fyShuffle(array);
    array.forEach((entry, i) => entry.trainerId = tIds[i]);
    return array;
}

//Fisher-Yates shuffle (modifies array in-place)
function fyShuffle<T>(array: T[]) {
    var currentIndex = array.length, randomIndex: number;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }

    return array;
}

const classShuffle: RandoModule = {
    command: "class-shuffle",
    helpText: "Usage: class-shuffle <filename> <mode>\nModes: shuffle-isolate (default), shuffle-keep-special, shuffle-all, random-isolate, random-keep-special, random-all",
    operation
}

export default classShuffle;