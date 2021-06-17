import NARChive from "../lib/NARChive";

const importantClasses = [10, 11, 12, 19, 20, 21, 22, 23, 37, 38, 40, 47, 54, 55, 56, 78, 79, 80, 81, 82, 88, 89, 97, 100, 101, 102];

type classIdMapping = {
    classId: number;
    trainerId: number;
}

function operation(filename: string, file: Buffer): Buffer {
    const narc = new NARChive(file);

    const trainerClassIds = narc.files.map((data, i) => ({
        classId: data[1],
        trainerId: i
    }));
    const normalTrainers = trainerClassIds.filter(t => !isSpecialTrainer(t.classId));
    const specialTraners = trainerClassIds.filter(t => isSpecialTrainer(t.classId));

    console.log(`"Found ${trainerClassIds.length} trainers, ${normalTrainers.length} normal and ${specialTraners.length} special.`);
    console.log("Shuffling trainer classes...");

    shuffleAndRemap(normalTrainers);
    shuffleAndRemap(specialTraners);

    const remapped = [...normalTrainers, ...specialTraners];

    narc.files.forEach((data,i) => {
        const oldClass = data[1];
        const newClass = (remapped.find(t => t.trainerId == i) || { trainerId: i, classId: oldClass }).classId;
        data[1] = newClass;
        console.log(`Trainer ${i}: ${oldClass} -> ${newClass} ${isSpecialTrainer(oldClass) ? "*SPECIAL*" : ""}`);
    });

    return narc.getBytes();
}

function isSpecialTrainer(cId: number) {
    return importantClasses.indexOf(cId) >= 0;
}

function shuffleAndRemap(array: classIdMapping[]) {
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
    helpText: "Usage: class-shuffle filename",
    operation
}

export default classShuffle;