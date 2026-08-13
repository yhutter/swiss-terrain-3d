
#run build();

build :: () {
    w := compiler_create_workspace("Swiss Terrain 3D");
    if !w {
        print("Workspace creation failed!");
        return;
    }

    BUILD_DIRECTORY :: "./build/";
    
    target_options := get_build_options(w);
    copy_commonly_propagated_fields(get_build_options(), *target_options);

    target_options.output_executable_name = "swissterrain3d";
    target_options.output_path = BUILD_DIRECTORY;
    make_directory_if_it_does_not_exist(BUILD_DIRECTORY);

    set_build_options(target_options, w);
    set_build_options_dc(.{ do_output = false });

    compiler_begin_intercept(w);
    add_build_file("src/main.jai", w);


    while true {
        message := compiler_wait_for_message();
        if message.kind == .COMPLETE {
            print("Done.");
            break;
        }
    }

    compiler_end_intercept(w);
    run_build_result_of_workspace(w);
}

#import "Basic";
#import "File";
#import "Autorun";
#import "Compiler";
