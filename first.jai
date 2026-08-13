
#run build();

build :: () {
    w := compiler_create_workspace("Swiss Terrain 3D");
    if !w {
        print("Workspace creation failed!");
        return;
    }

    build_directory := "./build";
    
    target_options := get_build_options(w);
    copy_commonly_propagated_fields(get_build_options(), *target_options);

    target_options.output_executable_name = "swissterrain3d";
    target_options.output_path = build_directory;
    make_directory_if_it_does_not_exist(build_directory);

    set_build_options(target_options, w);

    add_build_file("src/main.jai", w);
    set_build_options_dc(.{ do_output = false });

    run_build_result_of_workspace(w);
}

#import "Basic";
#import "File";
#import "Autorun";
#import "Compiler";
