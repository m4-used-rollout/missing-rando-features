declare interface RandoModule {
    command: string;
    helpText: string;
    operation: (filename: string, file: Buffer, ...params: string[]) => Buffer;
}