import * as path from 'path';
import { pri, tempTypesPath, tempJsEntryPath } from 'pri';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as normalizePath from 'normalize-path';

const modelRoot = `src${path.sep}model`;

/** Set white files */
pri.project.whiteFileRules.add(file => {
  return [modelRoot].some(whiteName => path.format(file) === path.join(pri.projectRootPath, whiteName));
});

pri.project.whiteFileRules.add(file => {
  const relativePath = path.relative(pri.projectRootPath, file.dir);
  return relativePath.startsWith(modelRoot);
});

/** Support pri/model alias */
const modelFilePath = path.join(pri.projectRootPath, tempTypesPath.dir, 'model.ts');
pri.build.pipeConfig(config => {
  if (!config.resolve.alias) {
    config.resolve.alias = {};
  }

  config.resolve.alias['pri/model'] = modelFilePath;

  return config;
});

/** Write modelFilePath */
const modelFilePathInfo = path.parse(modelFilePath);
interface IResult {
  projectAnalyseRematch: {
    modelFiles: {
      name: string;
      file: path.ParsedPath;
    }[];
  };
}

pri.project.onAnalyseProject(files => {
  return {
    projectAnalyseRematch: {
      modelFiles: files
        .filter(file => {
          if (file.isDir) {
            return false;
          }

          const relativePath = path.relative(pri.projectRootPath, path.join(file.dir, file.name));

          if (!relativePath.startsWith(modelRoot)) {
            return false;
          }

          return true;
        })
        .map(file => {
          return { file, name: safeName(file.name) };
        })
    }
  };
});

pri.project.onCreateEntry(async (analyseInfo: IResult, entry) => {
  if (analyseInfo.projectAnalyseRematch.modelFiles.length === 0) {
    return;
  }

  const entryRelativeToModel = ensureStartWithWebpackRelativePoint(
    path.relative(path.join(tempJsEntryPath.dir), path.join(modelFilePathInfo.dir, modelFilePathInfo.name))
  );

  entry.pipeAppHeader(header => {
    return `
        ${header}
        import { Provider } from 'react-redux'
        import { store } from "${normalizePath(entryRelativeToModel)}"
      `;
  });

  entry.pipeAppRouter(router => {
    return `
        <Provider store={store}>
          ${router}
        </Provider>
      `;
  });

  const modelsContent = `
      import { connect as reduxConnect } from 'react-redux'
      import { createStore, combineReducers, bindActionCreators } from 'redux'

      ${analyseInfo.projectAnalyseRematch.modelFiles
        .map(modelFile => {
          const importAbsolutePath = path.join(modelFile.file.dir, modelFile.file.name);
          const importRelativePath = ensureStartWithWebpackRelativePoint(
            path.relative(modelFilePathInfo.dir, importAbsolutePath)
          );
          return `import { reducer as ${modelFile.name}, InitialState as ${modelFile.name}InitialState, actions as ${
            modelFile.name
          }actions } from "${normalizePath(importRelativePath)}"`;
        })
        .join('\n')}

        const reducers = combineReducers({${analyseInfo.projectAnalyseRematch.modelFiles
          .map(storeFile => {
            return `${storeFile.name}`;
          })
          .join(',')}})

        export interface IState {
          ${analyseInfo.projectAnalyseRematch.modelFiles
            .map(modelFile => {
              return `${modelFile.name}: ${modelFile.name}InitialState;`;
            })
            .join('\n')}
        }
  
        // Strong type connect
        type IMapStateToProps = (
          state?: IState,
          props?: any
        ) => object;
  
        const actions = {
          ${analyseInfo.projectAnalyseRematch.modelFiles
            .map(modelFile => {
              return `${modelFile.name}: ${modelFile.name}actions,`;
            })
            .join('\n')}
        }

        function createActions(dispatch: any) {
          return {
            ${analyseInfo.projectAnalyseRematch.modelFiles
              .map(modelFile => {
                return `${modelFile.name}: bindActionCreators(${modelFile.name}actions, dispatch),`;
              })
              .join('\n')}
          }
        }

        export const connect = <T, MapState extends IMapStateToProps>(
          mapStateToProps?: MapState
        ): ((reactComponent: (props: React.Props<T> & ReturnType<MapState> & typeof actions) => any) => any) => {
          return reduxConnect(mapStateToProps, (dispatch: any) => createActions(dispatch));
        };

        export const store = createStore(reducers)
    `;

  const prettier = await import('prettier');

  // If has stores, create helper.ts
  fs.outputFileSync(
    modelFilePath,
    prettier.format(modelsContent, {
      semi: false,
      parser: 'typescript'
    })
  );
});

function safeName(str: string) {
  return _.camelCase(str);
}

export function ensureStartWithWebpackRelativePoint(str: string) {
  if (str.startsWith(path.sep)) {
    throw Error(`${str} is an absolute path!`);
  }

  if (!str.startsWith(`.${path.sep}`) && !str.startsWith(`..${path.sep}`)) {
    return `.${path.sep}${str}`;
  }
  return str;
}
