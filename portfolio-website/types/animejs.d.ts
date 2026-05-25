declare module 'animejs' {
  interface AnimeParams {
    targets?: any
    [key: string]: any
  }
  interface AnimeInstance {
    (params: AnimeParams): any
    stagger(value: number, options?: any): any
  }
  const anime: AnimeInstance
  export default anime
}
